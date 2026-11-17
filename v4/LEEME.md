# Web app del grupo — versión 4, «bosque y lima»

La misma app que la v2 con otra piel: la de **FitApp**, que usa los colores de temacy.ar. Verde bosque para lo que encuadra, lima para la acción y lo elegido, hueso de fondo, tarjetas claras con borde fino y tipografía Inter.

Es la otra propuesta que se pidió junto con la v3 (estilo sitio de Mavic). Las dos comparten la lógica: `app.js` y `movimiento.js` son **idénticos** en las dos carpetas, y un arreglo en uno va en los dos. Qué cambió respecto de la v2 y cómo está hecho el movimiento está en `../v3/LEEME.md`; cómo funciona por dentro, en `../v2/LEEME.md`.

## Lo propio de esta piel

- **Barra oscura arriba** con la marca y la raya lima; **navegación abajo** en el teléfono y **menú al costado** en la computadora.
- **El campo de consulta va en una pieza oscura**, como la foto de portada de FitApp, con los tres logos: dicen quiénes contestan.
- **Las entidades son tarjetas**, tres en fila desde tabletas. Los temas van en una lista con su dibujo en lima sobre bosque.
- **«Hay algo nuevo»** es una etiqueta lima que dice «Nuevo» en las filas (un punto lima sobre claro casi no se ve) y un punto que late en la navegación, que es oscura.
- **Con un chat a la vista la barra de arriba se va**: el chat ya dice con quién se habla.
- **Borrar las conversaciones** va en rojo, como las acciones que no se deshacen en FitApp.

## El movimiento

El de la v3, más corto, como en una app: los cambios de estado duran entre 120 y 200 ms y las entradas hasta 450 ms. Pasar de una vista a otra empuja de costado. No usa la cinta de texto, las luces de fondo ni la luz del cursor. Todo se apaga si la persona pidió menos movimiento.

## Tipografía

Inter, en la carpeta `fuentes/` (el mismo archivo que usa FitApp). Su licencia, SIL Open Font License, permite distribuirla; el texto está en `fuentes/OFL-Inter.txt`.

## A cuidar

Lo mismo que en la v3: la lista de archivos de `sw.js`, el teclado en un teléfono real y las transiciones fuera de Chrome.
