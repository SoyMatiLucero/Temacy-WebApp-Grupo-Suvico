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
- [ ] **La vista previa al compartir no aparece en WhatsApp** (se ve sólo el dominio). La página y la imagen responden bien a WhatsApp, Facebook, Telegram y Twitter cuando se las pide desde afuera, así que quedan dos causas:
  1. WhatsApp guardó un intento de cuando la app estuvo caída. Se comprueba pegando el enlace con algo atrás (`…/suvico-app/?1`): si ahí aparece, era eso y se arregla solo en unos días.
  2. El `robots.txt` de la raíz del dominio (está en `temacy-webs`) le prohíbe todo a todos, y los servidores de Meta lo respetan. Se arregla dejando pasar a `/suvico-app/` a los que arman vistas previas (`facebookexternalhit`, `WhatsApp`, `Twitterbot`, `TelegramBot`), sin sacar el «no indexar».

  El depurador de enlaces de Meta dice cuál de las dos es.
  *Listo cuando:* al pegar el enlace en WhatsApp se ven el título, la descripción y la imagen.
- [ ] **Confirmar en un iPhone, con la app anclada, que las pestañas quedan abajo.** El arreglo está publicado y sólo está comprobado por simulación.
  *Listo cuando:* alguien lo ve bien en el teléfono (abrir, cerrar y volver a abrir). Si no, cinco toques en el nombre de la app muestran los números para mandar.
- [ ] **Poner al día `LEEME.md` y `CLAUDE.md`.** Todavía describen la publicación por FTP y dan por pendientes dos cambios del workflow que ya están aplicados. Borrar `docs/workflow-pendiente.patch`.
  *Listo cuando:* lo que dicen sobre publicar coincide con `.github/workflows/deploy-ftp.yml`.

## Sprint 1 — Que no baje lo que no hace falta

Objetivo: primera visita de 569 kB a menos de 220 kB; segunda visita de 81 kB a menos de 5 kB.

- [ ] **Logos livianos para Mavic y OSPEVIC.** Se muestran en un recuadro de 52 px y pesan 167 kB y 72 kB (el de SUVICO pesa 5 kB). Es un dato, no código: volver a subirlos desde el panel de la plataforma, de 256 px de lado y menos de 15 kB.
  *Listo cuando:* la primera visita baja menos de 30 kB de la plataforma (hoy 249 kB).
- [ ] **Dejar que los `.js` y `.css` se guarden.** Hoy el `.htaccess` les pide «sin caché» y este hosting, además, no sabe contestar «no cambió»: los manda enteros cada vez, y su red de distribución no los guarda (responde en ~0,42 s contra ~0,20 s de lo que sí guarda). Ya no hace falta: van con el sello de la publicación en la dirección, así que una publicación nueva es una dirección nueva. Dejar «sin caché» sólo para los `.html`, `sw.js` y el manifiesto.
  Cuidado: `sw.js` es un `.js` y tiene que seguir sin caché. Comprobar antes que ninguna página pida un `.js` o `.css` sin sello.
  *Dónde:* `.github/deploy/htaccess`. *Listo cuando:* `app.js?v=<sello>` responde con caché de varios días y la segunda pasada sale de la red de distribución (`x-hcdn-cache-status: HIT`).
- [ ] **El service worker baja de nuevo sólo cuando hay una publicación nueva.** Hoy, cada vez que se abre la app, vuelve a pedir sus 19 archivos por detrás: 79 kB. Con el sello, `sw.js` cambia en cada publicación y el navegador ya lo revisa solo: alcanza con bajar todo al instalarse. En desarrollo el sello no cambia (`__SELLO__`), así que ahí tiene que seguir refrescando como hoy.
  Mirar de paso una copia por sello (`grupo-v5-<sello>`), para que el cambio de versión sea de una sola vez y no archivo por archivo.
  *Dónde:* `sw.js`. Pasa por el agente `revisor` antes de publicarse: un error acá deja teléfonos con una versión vieja. *Listo cuando:* la segunda visita hace 2 pedidos o menos a la app.
- [ ] **En la primera visita, no bajar dos veces lo mismo.** El service worker pide las tipografías y los íconos con el sello en la dirección; la página los pide sin él, y el navegador los toma por archivos distintos: 142 kB duplicados. Pedirlos por la misma dirección que usa la página y sin forzar la red.
  Depende de las dos tareas anteriores.
  *Dónde:* `sw.js`. *Listo cuando:* la primera visita baja menos de 190 kB de la app (hoy 320 kB).

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

- [ ] **Un presupuesto que la prueba haga cumplir.** Hoy `pruebas/rendimiento.js` sólo informa. Que falle si se pasa de: primera visita 220 kB; segunda visita 5 kB; inicio completo 2 s (primera) y 1 s (segunda); trabas 100 ms; saltos de pantalla, ninguno. Ajustar los topes a lo que quede después de los sprints 1 y 2.
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

---

## Cómo se mide

```
PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js                                              # local: también entra a los chats
URL=https://web.temacy.com/suvico-app/ PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js        # publicada: sin entrar a los chats
```

Hace tres pasadas de cada visita y se queda con la del medio. Deja el detalle de cada pedido en un archivo `rendimiento-<sitio>.json`.

Contra la app publicada no entra a los chats, para no dejar nada en producción. Es un navegador de computadora con el procesador frenado: sirve para comparar un antes y un después, no como número absoluto, y no ve lo que cuesta dibujar (para eso está el sprint 4).

Al cerrar un sprint: correr las dos, actualizar la tabla de «Dónde estamos» con la fecha y tildar lo que cumplió su «listo cuando».
