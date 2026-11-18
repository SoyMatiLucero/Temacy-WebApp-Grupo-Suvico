# Versiones de referencia

Las cuatro versiones que se hicieron antes de elegir. Quedan guardadas para consultarlas (cómo se resolvió algo, cómo se veía otra piel) y **no se mantienen**: un arreglo va sólo en la app.

La que se eligió, el 18-11-2026, fue la quinta (la v5, «neutra»): es la app, y sus archivos están en la raíz del repo.

| Carpeta o archivo | Qué es |
|---|---|
| `v1/` | La primera versión (17-11-2026): tres tarjetas y, al elegir una, el chat de esa entidad. Quedó como estaba cuando se entregó, y como plan B. |
| `v2/` | La versión mejorada (17-11-2026): una sola app con los tres chats vivos adentro. Cómo está hecha: `v2/LEEME.md`. Funciona bien pero no gustó cómo se ve: sobria y sin movimiento. |
| `v3/` | Propuesta «de noche» (17-11-2026): la v2 con el estilo del sitio de Mavic y con movimiento. `v3/LEEME.md`. Gustó, pero su inicio parecía el sitio de Mavic: de ahí salió la v5, que es la v3 sin el color de ninguna entidad. |
| `v4/` | Propuesta «bosque y lima» (17-11-2026): la v2 con el estilo de FitApp y con movimiento. `v4/LEEME.md`. |
| `comparar.html` | La página que muestra dos versiones lado a lado. La sirve `../servidor-local.js`. |

La v3, la v4 y la v5 son la misma app por dentro (la lógica de la v2) con pieles distintas. Por eso los LEEME de la v2 y de la v3 siguen siendo la explicación de cómo funciona la v5.

## Verlas

Desde la raíz del repo, con la API de la plataforma corriendo:

```
API=http://127.0.0.1:3110 node servidor-local.js referencia
```

v1 en `:4510`, v2 en `:4520`, v3 en `:4530`, v4 en `:4540`, la app en `:4550` y dos lado a lado en `:4505`. Más detalle en `../LEEME.md`.

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

La v1 usa el chat de la plataforma tal cual, suelto en la página. Desde la v2 (y en la v5) cada chat va dentro de un marco, y eso tiene un precio:

- **El teclado del teléfono lo maneja la app**, no el chat. La cuenta es la misma que hace el chat de la plataforma, pero en una computadora no se puede probar: **hay que verla en un Android y en un iPhone reales antes de publicar**. `?depurar=1` dibuja los números en pantalla para mandar una captura.
- **Depende más de cómo está hecho el chat por dentro** (sus clases y lo que le contesta el servidor). Todo eso está junto y comentado en `charla.js`; si el chat cambia, ahí se arregla. La v1 depende de tres clases.

Si la prueba en teléfonos reales no convence, la v1 sigue siendo publicable, corrigiendo antes lo que está más abajo.

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

## De la v3 a la v5

Sólo la piel: la v5 es la v3 con base grafito y luz blanca, y el color únicamente en lo que es de cada entidad. Está contado en `../docs/la_app.md`.

## Lo que la revisión encontró en la v1

La v1 se revisó a fondo después de entregarla. Queda como estaba; esto es lo que habría que corregirle si se la publicara. Diez defectos confirmados, del más al menos importante:

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
