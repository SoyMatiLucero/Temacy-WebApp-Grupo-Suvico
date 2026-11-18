# Backlog — web app del grupo

Lo que falta, ordenado por sprints. Cada sprint tiene un objetivo que se puede medir y cada tarea dice cuándo está lista. Se tilda la tarea cuando se cumple su «listo cuando», no cuando se escribe el código.

Los números salen de `pruebas/rendimiento.js` (ver «Cómo se mide», al final). Punto de partida: 18-11-2026, con la publicación del commit `ed0d2b7`.

## Dónde estamos

La app publicada (`web.temacy.com/suvico-app/`), abierta como un teléfono de 393×852 con el procesador frenado cuatro veces y una 4G lenta:

| | Primera visita | Segunda visita (ya con la copia guardada) |
|---|---|---|
| El servidor responde | 0,36 s | 0,01 s |
| Aparece algo en pantalla | 1,1 s | 0,5 s |
| El inicio está completo (las tres entidades a la vista) | 3,0 s | 2,2 s |
| Pedidos a la red | 36 | 22 (todos por detrás) |
| Lo que baja | 569 kB | 81 kB |
| Trabas del procesador | 40 ms | 0 ms |
| Saltos de la pantalla | ninguno | ninguno |

En reposo, parada en el inicio: 0,2 % del procesador y ningún pedido. Entrar a un chat (medido sólo en local): entre 0,45 y 0,55 s hasta poder escribir.

**Lo que anda bien:** el código es liviano (42 kB comprimido para pintar el inicio), casi no traba el teléfono, la pantalla no salta y en reposo no gasta. Con la copia guardada, la app responde al toque.

**Lo que pesa, de los 569 kB de la primera visita:**

| | kB | |
|---|---|---|
| Los logos de Mavic (167 kB) y OSPEVIC (72 kB) | 244 | 43 % |
| Lo que el service worker vuelve a bajar y la página ya había bajado | 142 | 25 % |
| Lo que la app necesita para pintar: código (42 kB) y tipografías (96 kB) | 138 | 24 % |
| El resto de la copia sin conexión (el marco del chat, los íconos) | 40 | 7 % |
| La configuración de los tres chats | 5 | 1 % |

**Y lo que demora:** la entrada animada corre cada vez que se abre la app. Entre que aparece algo y que las tres entidades están en su lugar pasan 1,7 s, aunque todo ya esté en el teléfono.

---

## Sprint 0 — Que la publicación ande

Sin esto no se puede publicar nada de lo que sigue.

- [ ] **El deploy está fallando.** Desde el 18-11 la app se publica copiándola al repo `temacy-webs` (el hosting borraba lo que se subía por FTP). El primer deploy con ese camino falló en el paso «Copiar la app a temacy-webs»; lo más probable es que falte cargar el secret `WEBS_TOKEN`, y el registro del run lo dice. Lo resuelve quien administra los repos.
  *Listo cuando:* un push a `main` termina en verde y `sw.js` publicado trae el sello de ese commit.
- [x] **La vista previa al compartir en WhatsApp.** Comprobado el 18-11: al enviar el enlace se ven el título, la descripción y la imagen. Mientras se lo está escribiendo, WhatsApp puede mostrar sólo el dominio un rato: tarda en armarla. El `robots.txt` de la raíz del dominio no la bloquea.
- [ ] **Confirmar en un iPhone, con la app anclada, que las pestañas quedan abajo.** El arreglo está publicado y sólo está comprobado por simulación.
  *Listo cuando:* alguien lo ve bien en el teléfono (abrir, cerrar y volver a abrir). Si no, cinco toques en el nombre de la app muestran los números para mandar.
- [x] **Poner al día `LEEME.md` y `CLAUDE.md`.** Hecho el 18-11: describen la publicación por `temacy-webs` y se borró `docs/workflow-pendiente.patch`, que ya estaba aplicado.

## Sprint 1 — Que no baje lo que no hace falta

Objetivo: primera visita de 569 kB a menos de 300 kB; segunda visita de 81 kB a menos de 5 kB.

- [ ] **Logos livianos para Mavic y OSPEVIC.** Se muestran en un recuadro de 52 px y pesan 167 kB y 72 kB (el de SUVICO pesa 5 kB). El de Mavic, además, mide 5979×2000 puntos: para mostrarlo, el teléfono lo abre entero y eso son unos 48 MB de memoria. Es un dato, no código: hay que volver a subirlos desde el panel de la plataforma. Ya están hechos a 480 puntos de ancho (Mavic 18 kB, OSPEVIC 39 kB); sólo falta subirlos.
  *Listo cuando:* la primera visita baja menos de 70 kB de la plataforma (hoy 249 kB).
- [ ] **El logo de SUVICO es chico para un teléfono.** Mide 56×57 puntos y en una pantalla ×3 hacen falta unos 156: se ve borroso. No es de rendimiento, pero se arregla en el mismo lugar: subir uno de 256 puntos.
  *Listo cuando:* en un teléfono el logo de SUVICO se ve nítido.
- [ ] **El service worker baja de nuevo sólo cuando hay una publicación nueva.** Antes, cada vez que se abría la app, volvía a pedir sus 19 archivos por detrás: 79 kB. Con el sello, `sw.js` cambia en cada publicación y el navegador ya lo revisa solo: alcanza con bajar todo al instalarse, a una copia aparte con el nombre del sello, y repetir la bajada una vez un rato después por si agarró al servidor a medio copiar. En desarrollo sigue refrescando como antes.
  **Hecho en local el 18-11 y revisado; falta publicarlo.** Lo prueba `pruebas/copia.js`. A cambio de no pedir nada en cada apertura, cada publicación hace bajar el código dos veces a cada teléfono (unos 60 kB cada una).
  *Dónde:* `sw.js`. *Listo cuando:* publicada, la segunda visita hace 2 pedidos o menos a la app (hoy 19).
- [ ] **En la primera visita, no bajar dos veces las tipografías.** El service worker pedía las tipografías y los íconos con el sello en la dirección; la página los pide sin él, y el navegador los tomaba por archivos distintos: 96 kB de tipografías duplicados. Ahora los pide por la misma dirección que la página.
  El código (38 kB) sí se sigue bajando dos veces en la primera visita. Tomarlo de lo que la página ya había bajado resultó inseguro: la revisión encontró dos casos en que quedaba guardado código de la publicación anterior.
  **Hecho en local el 18-11, en el mismo cambio; falta publicarlo.**
  *Dónde:* `sw.js`. *Listo cuando:* publicada, la primera visita baja menos de 230 kB de la app (hoy 320 kB).
- [ ] **Probar una actualización en un iPhone.** El service worker nuevo está probado en Chromium, no en Safari. Después de publicarlo y de una publicación más: abrir la app anclada dos veces y ver que muestra lo nuevo, y que abre en modo avión.
  *Listo cuando:* alguien lo vio andar en un iPhone.
- [ ] **(Workflow) Que el sello salga de lo que se publica y no del commit.** Hoy cualquier push a `main`, aunque sólo toque un documento, cambia el sello y hace que todos los teléfonos bajen el código de nuevo. Si el sello se calcula sobre los archivos que se publican, un push que no toca la app no cambia nada. De paso: que el deploy selle y compruebe todas las páginas (`*.html`), no sólo `index.html` y `charla.html`. Lo tiene que subir quien tenga permiso para tocar workflows.
  *Listo cuando:* un push que no toca la app deja `sw.js` publicado igual que estaba.

Descartada: **dejar que la red de distribución del hosting guarde los `.js` y `.css`.** Ganaba 0,2 s por archivo en la primera visita, pero el hosting copia los archivos de a uno y su red no respeta el «sin caché»: si alguien pide un archivo justo durante una publicación, la versión vieja puede quedar guardada con la dirección nueva y servirse a todos por días. Con el cambio del service worker ya no hace falta.

## Sprint 2 — Que el inicio esté listo antes

Objetivo: inicio completo en menos de 1 s desde la segunda visita (hoy 2,2 s) y en menos de 2 s en la primera (hoy 3,0 s).

- [ ] **La entrada animada completa, sólo la primera vez.** Hoy corre en cada apertura y las tres entidades —lo que la persona vino a tocar— terminan de aparecer 1,7 s después que el resto. Propuesta: la entrada entera la primera vez que se abre la app en ese teléfono; después, una corta (0,4 s o menos) o ninguna. Es una decisión de diseño: verla en el teléfono antes de cerrarla.
  *Dónde:* `movimiento.js` (el estreno) y `app.css` (`.estreno`). *Listo cuando:* en la segunda visita el inicio completo llega menos de 0,5 s después de la primera pintura.
- [ ] **Tipografías más livianas.** Son cuatro archivos y 96 kB: el 70 % de lo que la app necesita para pintarse. Caminos, de menor a mayor trabajo: ver si hacen falta los dos pesos intermedios de Satoshi (400 y 500) y sacar uno, recortarlas a los caracteres que usa el español (se estima cerca de la mitad), o pasar a un solo archivo variable.
  Antes hay que confirmar la licencia, que ya estaba pendiente: recortar un archivo es modificarlo.
  *Dónde:* `fuentes/`, `app.css`, `charla.css`, `index.html` (las precargas) y la lista de `sw.js`. *Listo cuando:* las tipografías pesan menos de 55 kB en total.
- [ ] **Precargar sólo las tipografías de la primera pantalla.** Hoy se precargan dos de las cuatro (Cabinet Grotesk 800 y Satoshi 500); las otras dos se descubren recién al leer la hoja de estilos y pueden llegar después de la primera pintura, con lo que ese texto cambia de letra a la vista. Ver cuáles se usan arriba de todo y precargar ésas.
  *Listo cuando:* en la primera visita con 4G lenta, una captura a la primera pintura y otra un segundo después muestran la misma letra.
- [ ] **Abrir antes la conexión con la plataforma.** La configuración de los chats se pide recién cuando terminó de cargar el código. Avisarle al navegador desde el principio (`preconnect`) ahorra el saludo de conexión (en un teléfono se estima entre 0,3 y 0,6 s; no está medido). Sólo publicada: una prueba local no tiene que tocar producción.
  *Dónde:* `index.html` o `comun.js`. *Listo cuando:* los logos y los colores de las entidades aparecen antes en la primera visita, y `pruebas/directo.js` sigue en verde.

## Sprint 3 — Entrar a un chat

Objetivo: tener medido lo que tarda en abrirse un chat con la app publicada, y que el segundo y el tercero no esperen a la red. Casi todo depende de la plataforma, que es otro repo: se anota allá (sección 9 de `docs/plan_webapp.md`) y acá se sigue el estado.

- [ ] **Medir «entrar a un chat» como publicada.** Hoy está medido sólo en local, donde la plataforma contesta al instante. Sumar a `pruebas/rendimiento.js` el modo de `pruebas/directo.js` (el script de cada entidad, contra la API local) con la 4G lenta.
  *Listo cuando:* la tabla de arriba tiene la fila «entrar a un chat» con un número de red real.
- [ ] **(Plataforma) Que el chat se pueda guardar.** `widget.js` pesa 216 kB (70 kB comprimido) y se sirve con caché de cero segundos: cada chat que se abre vuelve a preguntar por él y espera la respuesta (1 s en la única medición hecha, desde la PC de desarrollo). Con unos minutos de caché y permiso para usar la copia mientras se revisa (`stale-while-revalidate`), el segundo y el tercer chat abren sin esperar.
  *Listo cuando:* `widget.js` responde con una caché mayor que cero.
- [ ] **(Plataforma) Achicar los logos al subirlos.** Es el arreglo de fondo de la primera tarea del sprint 1: que nadie pueda volver a cargar un logo de 167 kB.
  *Listo cuando:* un logo recién subido se sirve en menos de 15 kB.
- [ ] **Adelantar el chat cuando ya se puede guardar.** Con lo anterior resuelto, pedir `widget.js` por adelantado cuando la persona lleva unos segundos en el inicio, salvo con el ahorro de datos activado.
  *Listo cuando:* el primer chat abre sin bajar `widget.js` en ese momento.

## Sprint 4 — Lo que esta medición no ve: dibujar y batería

`pruebas/rendimiento.js` corre en una computadora y no mide lo que cuesta dibujar, que va por la placa de video. Esto se mide con teléfonos en la mano.

- [ ] **Medir en un Android de gama baja y en un iPhone.** Con la inspección remota del navegador: cuadros por segundo al desplazar el inicio y al pasar de una vista a otra, y consumo con la app quieta un minuto.
  *Listo cuando:* están anotados acá los cuadros por segundo de cada teléfono.
- [ ] **Las luces de fondo.** Son tres manchas de hasta 92 % del lado largo de la pantalla que se mueven sin parar mientras se ve el inicio. En un teléfono de 393×852 con pantalla ×3 pueden ocupar hasta unos 42 MB de memoria de video. Como son manchas difusas, se pueden dibujar a un tercio del tamaño y agrandar con `transform` sin que se note, y frenarlas a los pocos segundos.
  *Dónde:* `app.css` (`.luces`). *Listo cuando:* el inicio mantiene los cuadros por segundo del teléfono lento medido en la tarea anterior.
- [ ] **El vidrio esmerilado.** El campo de consulta y las pestañas desenfocan lo que tienen atrás (`backdrop-filter`), y atrás hay luces que se mueven: el teléfono recalcula el desenfoque en cada cuadro. Si la medición lo muestra caro, apagarlo mientras las luces se mueven o cambiarlo por un fondo liso translúcido en teléfonos lentos.
  *Dónde:* `app.css`. *Listo cuando:* desplazar el inicio no pierde cuadros en el teléfono lento.
- [ ] **Tres conexiones abiertas.** Cada chat abierto mantiene su conexión en vivo con la plataforma, también con la app en segundo plano. En reposo no hacen pedidos (medido), pero falta ver qué le hacen a la batería en una hora.
  *Listo cuando:* está medido y, si pesa, anotado para la plataforma.

## Sprint 5 — Que no se vuelva atrás

- [ ] **Un presupuesto que la prueba haga cumplir.** Hoy `pruebas/rendimiento.js` sólo informa. Que falle si se pasa de: primera visita 300 kB; segunda visita 5 kB; inicio completo 2 s (primera) y 1 s (segunda); trabas 100 ms; saltos de pantalla, ninguno. Ajustar los topes a lo que quede después de los sprints 1 y 2.
  *Listo cuando:* la prueba termina en rojo si un cambio rompe un tope.
- [ ] **Correrla antes de publicar un cambio que toque la carga** y actualizar la tabla de «Dónde estamos».
  *Listo cuando:* está escrito en `CLAUDE.md`, junto a las otras pruebas.

## Otros pendientes (no son de rendimiento)

- [ ] Probar en teléfonos reales lo que ninguna prueba ve: el teclado, el micrófono, adjuntar un archivo y las transiciones entre vistas en iPhone.
- [ ] Confirmar la licencia de las tipografías (ver `referencia/v3/LEEME.md`).
- [ ] Los íconos de la app instalada (`icons/`) siguen siendo los de la versión 2.
- [ ] Mavic y OSPEVIC tienen colores casi iguales y sus tarjetas se confunden. Es de la configuración de cada una en la plataforma.
- [ ] En teléfonos chicos, los ocho botones de arranque del chat de SUVICO tapan parte del saludo. También es configuración de la plataforma.
- [ ] Decidir cuándo se saca el «no indexar» (hoy la app queda fuera de Google a propósito).
- [ ] Darle a la app un dominio o subdominio propio. Hoy comparte `web.temacy.com` con otros sitios en borrador, y para el navegador todos son el mismo sitio: comparten lo que se guarda en el teléfono (la copia sin conexión incluida).

---

## Cómo se mide

```
PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js                                              # local: también entra a los chats
URL=https://web.temacy.com/suvico-app/ PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js        # publicada: sin entrar a los chats
```

Hace tres pasadas de cada visita y se queda con la del medio. Deja el detalle de cada pedido en un archivo `rendimiento-<sitio>.json`.

Contra la app publicada no entra a los chats, para no dejar nada en producción. Es un navegador de computadora con el procesador frenado: sirve para comparar un antes y un después, no como número absoluto, y no ve lo que cuesta dibujar (para eso está el sprint 4).

Al cerrar un sprint: correr las dos, actualizar la tabla de «Dónde estamos» con la fecha y tildar lo que cumplió su «listo cuando».
