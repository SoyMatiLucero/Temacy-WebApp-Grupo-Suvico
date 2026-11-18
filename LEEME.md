# Web app del grupo — Suvico · Mavic · Ospevic

La puerta de entrada común a los chats de las tres entidades. El plan completo (fases, decisiones y pendientes) está en `docs/plan_webapp.md`.

Este repo es sólo la app. El chat (`/widget.js`) y su API (`/api/web-chat/`) los sirve la plataforma, que vive en otro repo; cuando un documento de acá nombra `platform/…` o `deploy/…`, habla de ese repo. La app nació ahí como `web_grupo/` y pasó a este repo el 18-11-2026.

Cada versión vive en su carpeta, para poder compararlas:

| Carpeta | Qué es |
|---|---|
| `v1/` | La primera versión (17-11-2026): tres tarjetas y, al elegir una, el chat de esa entidad. Queda congelada como punto de comparación y como plan B. |
| `v2/` | La versión mejorada (17-11-2026): una sola app con los tres chats vivos adentro. Cómo está hecha: `v2/LEEME.md`. Funciona bien pero no gustó cómo se ve: sobria y sin movimiento. |
| `v3/` | Propuesta «de noche» (17-11-2026): la v2 con el estilo del sitio de Mavic y con movimiento. `v3/LEEME.md`. |
| `v4/` | Propuesta «bosque y lima» (17-11-2026): la v2 con el estilo de FitApp y con movimiento. `v4/LEEME.md`. |
| `v5/` | La v3 «neutra» (18-11-2026): mismo contenido y movimiento, sin el color de Mavic. Base grafito, luz blanca, y el color sólo en lo que es de cada entidad. `v5/LEEME.md`. |

La v3, la v4 y la v5 son la misma app por dentro (la lógica de la v2) con pieles distintas: hay que elegir una. La v5 salió de la v3: gustó, pero su inicio parecía el sitio de Mavic.

## Verlas en esta máquina

Hace falta la API de la plataforma corriendo. Con Node 20:

```
API=http://127.0.0.1:3110 node servidor-local.js
```

- v1: `http://127.0.0.1:4510`
- v2: `http://127.0.0.1:4520`
- v3: `http://127.0.0.1:4530`
- v4: `http://127.0.0.1:4540`
- v5: `http://127.0.0.1:4550`
- dos versiones lado a lado, como teléfono o como escritorio: `http://127.0.0.1:4505` (arranca con las dos últimas y deja elegir cuáles)

Con `RED=1` adelante escucha también en la red local, para abrirla desde un teléfono (ahí no hay modo sin conexión ni micrófono: el navegador los reserva para https).

`servidor-local.js`, `comparar.html`, `nginx-subdominio.ejemplo.conf` y `pruebas/` son herramientas de trabajo: no se publican.

## Qué cambia de la v1 a la v2

| | v1 | v2 |
|---|---|---|
| **Lo primero que se ve** | «¿Con quién querés hablar?» y tres tarjetas. | «¿Qué necesitás?»: un campo para escribir, las conversaciones, lo más pedido y los temas. |
| **El que no sabe a quién preguntarle** | Tiene que adivinar entre sindicato, mutual y obra social. | Busca con sus palabras («préstamo», «medicamento») entre lo que cada entidad ya ofrece y la app le dice de quién es. O escribe la consulta y elige a quién mandarla; si no era para ese, se la manda a otro sin escribirla de nuevo. |
| **Pasar de una entidad a otra** | Cerrar el chat, volver, elegir y esperar que cargue: tres toques y dos cargas de página. | Un toque. Es instantáneo (medido: 44 ms) y cada conversación sigue donde estaba. |
| **Enterarse de que contestaron** | No se entera. | Un punto en la pestaña y en la lista, el aviso «SUVICO te contestó» y la cuenta en el título y en el ícono. Dice con claridad que avisa sólo con la app abierta. |
| **El inicio, con conversaciones empezadas** | «Seguir la conversación». | El último mensaje, la hora, y si la conversación pasó a una persona del equipo. De la obra social no muestra el texto, sólo que contestaron. |
| **En computadora** | Lo mismo que en el teléfono, más grande. | La lista a la izquierda y el chat a la derecha. |
| **Sin conexión** | Las tarjetas parecen activas y fallan al tocarlas. | Dice «Sin conexión» y no deja tocar lo que va a fallar. Un chat que ya estaba abierto se puede seguir leyendo. |
| **Con mala señal** | Espera hasta 4 segundos a la red antes de mostrar nada. | Abre al toque desde la copia guardada y se pone al día por detrás. |
| **Instalarla** | Un botón, sólo en Android, desde el primer segundo. | Se ofrece después de la primera conversación. En iPhone explica el camino. Accesos directos a cada entidad desde el ícono. |
| **Teléfono compartido** | Nada. | «Borrar mis conversaciones de este teléfono», explicando qué borra y qué no. |
| **Carga sobre la plataforma** | Pide la configuración de cada entidad en cada pantalla, y el chat la pide otra vez. | Una vez por entidad cada diez minutos, la pida quien la pida. La consulta periódica de los chats que no se están viendo se espacia. |
| **Trato con el chat de la plataforma** | Lo abre apenas aparece, antes de que termine de configurarse (eso le duplica el pedido y le rompe el botón de voz). | Espera a que esté listo. No deja que un chat de fondo tome el foco ni lea en voz alta. No manda un texto si hay un trámite a medio completar. |
| **Las palabras** | «Entidad», «Te atiende Emilia». | «El sindicato, la mutual, la obra social»; «asistente virtual». |

Lo que no cambia: son los mismos tres chats, cada conversación queda sólo en su entidad, no hay login y no hay backend nuevo.

### El costo de la v2

La v1 usa el chat de la plataforma tal cual, suelto en la página. En la v2 cada chat va dentro de un marco, y eso tiene un precio que hay que conocer antes de elegirla:

- **El teclado del teléfono lo maneja la app**, no el chat. La cuenta es la misma que hace el chat de la plataforma, pero en una computadora no se puede probar: **hay que verla en un Android y en un iPhone reales antes de publicar**. `?depurar=1` dibuja los números en pantalla para mandar una captura.
- **Depende más de cómo está hecho el chat por dentro** (sus clases y lo que le contesta el servidor). Todo eso está junto y comentado en `v2/charla.js`; si el chat cambia, ahí se arregla. La v1 depende de tres clases.

Si la prueba en teléfonos reales no convence, la v1 sigue siendo publicable, corrigiendo antes lo que sigue.

## Qué cambia de la v2 a la v3 y la v4

Por dentro, nada de fondo: son los mismos marcos, los mismos mensajes y las mismas reglas de privacidad. Cambia cómo se ve y cómo se mueve, y tres cosas de uso:

| | v2 | v3 y v4 |
|---|---|---|
| **Cómo se ve** | Neutros claros, tipografía del sistema, sin marca. | v3: la noche y el turquesa del sitio de Mavic. v4: el bosque, la lima y el hueso de FitApp. Cada una con su tipografía. |
| **Movimiento** | Ninguno. | Entrada al abrir, transición al pasar del inicio a un chat y entre chats, marca de pestaña que se desliza, ejemplos que rotan en el campo de consulta. La v3 suma cinta de texto y luces de fondo. Se apaga si la persona pidió menos movimiento. |
| **En computadora** | El inicio como columna angosta y el chat al lado; sin chat elegido, media pantalla vacía. | Una cosa por vez, como en el teléfono, y las pestañas hacen de menú (arriba en la v3, al costado en la v4). |
| **«Lo más pedido» en el teléfono** | Doce botones apilados. | Un renglón por entidad que se desliza de costado. |
| **El campo de consulta** | «Escribí tu consulta». | Va mostrando preguntas de ejemplo de las tres entidades. |

Lo que suman de costo: tipografías propias (unos 100 KB en la v3 y 48 KB en la v4, guardadas en el teléfono después de la primera vez) y un archivo más (`movimiento.js`). Las transiciones entre vistas usan una función del navegador que no está en todos: donde falta, el cambio es seco.

## Lo que la revisión encontró en la v1

La v1 se revisó a fondo después de entregarla. Queda como estaba, para comparar; esto es lo que habría que corregirle si se la publicara. Diez defectos confirmados, del más al menos importante:

1. **Abre el chat antes de que llegue su configuración.** El chat la pide dos veces y el botón «leer las respuestas en voz alta» queda sin andar (`v1/app.js`, la espera del botón).
2. **Con señal débil tarda hasta 8 segundos en mostrarse** aunque esté guardada: espera 4 segundos a la red por cada archivo (`v1/sw.js`).
3. **Con lector de pantalla, se sale del chat** hacia la página que el chat está tapando.
4. **Los 10 segundos de espera cuentan antes de que baje el chat:** con mala señal dice «No pudimos abrir el chat» y después el chat aparece igual.
5. **Todo va en cascada:** el chat recién se pide cuando contesta la configuración de la app.
6. **Instalada, queda bloqueada en vertical** (`"orientation": "portrait"`).
7. **En iPhone no hay forma de instalarla.**
8. **«Entidades» no se puede decir por voz:** su nombre para el control por voz es otro.
9. **El nombre del bot puede no coincidir** con el que muestra el chat, si la entidad cargó un asesor.
10. **En un teléfono compartido, el inicio dice quién consultó a la obra social,** y no hay forma de borrarlo.

La v2 no tiene ninguno de los diez.

## Para publicar (cualquiera de ellas)

1. **Subdominio y certificado.** Ojo: un subdominio que apunte a la máquina sin su bloque de nginx cae en el bloque general y muestra el panel de gestión.
2. **nginx.** `nginx-subdominio.ejemplo.conf` es la propuesta, sin probar. Sirve la carpeta publicada, le reenvía a la API sólo el chat (`/api/web-chat/`, `/socket.io/`, `/widget.js`) y **redirige** al dominio de la plataforma lo que es contenido subido (`/uploads/`, `/brands/`, `/privacidad/`). Esto último es de seguridad y no hay que «simplificarlo»: en el dominio de la app quedan guardadas las credenciales de las tres conversaciones, y ahí no se sirve nada que haya subido nadie.
3. **Guion de publicación** como `deploy/publicar-web.sh` (respaldo, checksums y verificación). Tiene que comprobar que estén todos los archivos de la lista de `sw.js`: si falta uno, los teléfonos no se actualizan.
4. **Probar en teléfonos reales** (v2, v3 y v4): teclado, micrófono, adjuntar, instalar. En la v3 y la v4, además, las transiciones entre vistas en iPhone.
5. **Tipografías de la v3:** confirmar la licencia antes de publicar (ver `v3/LEEME.md`).

Lo que hay que resolver en la plataforma, que no es de la app, está en `docs/plan_webapp.md`, sección 9.

## Pruebas

`pruebas/recorrido.js` y `pruebas/recorrido-delicado.js` recorren la app como un usuario, en un navegador de verdad (Playwright), en teléfono y en escritorio, mandando mensajes reales a los bots de la base local. Sirven para la v2, la v3 y la v4: se les pasa la dirección y detectan la versión solas.

```
PLAYWRIGHT=<carpeta de playwright> URL=http://127.0.0.1:4530/ node pruebas/recorrido.js
PLAYWRIGHT=<carpeta de playwright> URL=http://127.0.0.1:4530/ node pruebas/recorrido-delicado.js
```

Sin `URL` prueban la v2. Con `rapido` al final, el primero no manda mensajes. Cada corrida deja conversaciones de prueba en la base local.
