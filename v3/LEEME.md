# Web app del grupo — versión 3, «de noche»

La misma app que la v2 con otra piel: la del **sitio de Mavic** (`sitio-mavic/v3`). Fondo de noche, el turquesa como luz, títulos en Cabinet Grotesk, texto en Satoshi, píldoras de vidrio, y movimiento.

Nació porque la v2, clara y sobria, no gustó: se pidió animación y que tomara el estilo de ese sitio. La v4 es la otra propuesta (estilo FitApp). Las dos comparten la lógica y se diferencian sólo en la piel.

## Qué cambia respecto de la v2

Cómo funciona por dentro (un marco por entidad, los mensajes entre la app y los marcos, «hay algo nuevo», privacidad, el teclado) está en `../v2/LEEME.md` y sigue valiendo. Lo que cambia:

- **Se ve una cosa por vez, también en la computadora**: el inicio o un chat. En la v2 de escritorio el inicio era una columna angosta y el resto quedaba vacío hasta elegir un chat. Ahora el inicio ocupa la pantalla y las pestañas hacen de menú: abajo y flotando en el teléfono, arriba en la computadora.
- **«Lo más pedido» va en un renglón por entidad**, que en el teléfono se desliza de costado. Apilados, doce botones eran una pantalla entera.
- **El campo de consulta muestra ejemplos** que van pasando. Son las preguntas de `entidades.js`; no se inventa ninguna.
- **El chat es una ventana encendida.** El chat de la plataforma es claro y no tiene modo oscuro, así que la app lo muestra enmarcado sobre la noche. Por dentro no se lo toca.

## El movimiento

| Qué | Dónde está | Cómo es |
|---|---|---|
| Entrada de la primera vez | `app.css`, clase `.estreno` | El título sube palabra por palabra y lo demás llega escalonado. Se ve una sola vez, al abrir: `movimiento.js` saca la clase a los 2,6 s. |
| Pasar de una vista a otra | `app.js` (`conMovimiento`) y `app.css` (`::view-transition`) | Una transición del navegador. `data-ir` en `<html>` dice hacia dónde: entrar, volver, derecha o izquierda. |
| La marca de la pestaña elegida | `app.js` (`ubicarLuz`) y `.pestanas-luz` | Una pieza que se desliza de una pestaña a otra. |
| Ejemplos en el campo | `app.js` (`prepararEjemplos`) | Cambia cada 3,6 s mientras el campo está vacío y a la vista. |
| Cinta de texto | `movimiento.js`, `[data-cinta]` | Dos filas con los temas y las entidades. Tiene botón de pausa y recuerda la elección. |
| Entrar al desplazar | `movimiento.js`, `[data-revelar]` | Sólo esconde lo que está debajo de la pantalla al cargar. |
| Luces de fondo y luz del cursor | `app.css` (`.luces`) y `movimiento.js` (`data-luz`) | Tres resplandores que derivan. Cada pieza se enciende con el color de su entidad. |

Reglas que se cuidaron:

- **Todo se apaga** si la persona pidió menos movimiento en su teléfono o computadora.
- **Sin JavaScript de adorno no queda nada oculto**: `movimiento.js` puede faltar y la app se usa igual.
- **Lo que no se ve no se mueve**: con un chat a la vista, la cinta y las luces quedan en pausa.
- Sólo se animan posición y opacidad, que no hacen recalcular la página.
- Donde el navegador no tiene transiciones entre vistas, el cambio es seco y el chat entra con un fundido.

## Archivos

Los de la v2 más `movimiento.js` y la carpeta `fuentes/`. `app.js` y `movimiento.js` son **idénticos** a los de la v4: un arreglo en uno va en los dos. Lo propio de esta piel es `index.html`, `app.css`, `charla.css`, `manifest.webmanifest`, `sw.js` (la lista de archivos) y `comun.js` (sólo el número de versión).

## Tipografías

Cabinet Grotesk y Satoshi, de Fontshare, las mismas del sitio de Mavic. Acá van **en la carpeta `fuentes/`** en vez de pedírselas a Fontshare: la app tiene que abrir sin conexión y no conviene que el teléfono del afiliado le avise a un tercero cada vez que la abre.

**A confirmar antes de publicar:** la licencia es la ITF Free Font License. Lo que se encontró dice que permite alojar los archivos en el sitio propio, pero no se pudo leer el texto oficial. Si no lo permitiera, la salida es cargarlas desde Fontshare como hace el sitio, y sumar ese dominio a la política de contenido de nginx.

## A cuidar

- Al sumar un archivo hay que sumarlo a `ARCHIVOS` en `sw.js`. Si falta uno, los teléfonos no se actualizan.
- El teclado en un teléfono real sigue sin probarse, igual que en la v2.
- Las transiciones entre vistas no se probaron en iPhone ni en Firefox, sólo en Chrome.
