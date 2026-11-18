# La app — era la versión 5, «neutra»

**Es la versión elegida (18-11-2026).** Sus archivos están en la raíz del repo (`index.html`, `app.js` y los demás); hasta ese día vivían en la carpeta `v5/`, y por eso el nombre de su copia guardada (`grupo-v5`, en `sw.js`) y el número de `comun.js` (`VERSION = 5`) siguen diciendo 5. Las otras cuatro versiones quedaron en `../referencia/`, para consultarlas.

La versión 3 sin el color de ninguna entidad. Nació el 18-11-2026: la v3 gustó, pero su inicio se veía como el sitio de Mavic (fondo azul de noche y turquesa), y una app de tres entidades no puede parecer de una. Se pidió conservar el contenido y lo moderno, y sacarle esa identidad.

## Qué cambia respecto de la v3

Sólo la piel. El contenido, la disposición, las animaciones y el comportamiento son los de la v3: `app.js`, `movimiento.js`, `charla.js`, `entidades.js` y `charla.html` son idénticos byte a byte a los de `../referencia/v3/`. Las versiones de referencia ya no se mantienen: un arreglo va sólo en la app.

| | v3 | La app (v5) |
|---|---|---|
| Fondo | Azul de noche (`#051019`) con resplandor turquesa | Grafito (`#0b0d10`) con resplandor claro |
| La luz (acento) | Turquesa | Blanca: botones, foco, pestaña elegida, aviso de «te contestaron» |
| Título | «necesitás?» en turquesa | Dos tonos sin color: «¿Qué» apagado, «necesitás?» encendido |
| Luces de fondo | Turquesa, rojo y celeste | Dos frías y una apenas cálida; ninguna es de una entidad |
| El chat (lo claro) | Papel azulado | Papel gris neutro |

**Dónde sí hay color:** en lo que es de cada entidad. Su tarjeta se enciende con su color, su etiqueta («El sindicato», «La mutual», «La obra social») lo toma, y su logo y el encabezado de su chat son los suyos. El color sale de la configuración de cada chat en la plataforma (`--marca`, que escribe `app.js`); si una entidad cambia el suyo, acá cambia solo.

Archivos que difieren de la v3: `app.css`, `charla.css`, `index.html` (el color de la barra del navegador y un comentario), `manifest.webmanifest`, `sw.js` (nombre de la copia: `grupo-v5`) y `comun.js` (`VERSION = 5`).

## Lo que sigue valiendo de la v3

Todo lo demás: el movimiento y sus reglas, las tipografías (Cabinet Grotesk y Satoshi, en `fuentes/`; la licencia hay que confirmarla antes de publicar), lo que no se probó. Está en `../referencia/v3/LEEME.md`. Cómo funciona por dentro, en `../referencia/v2/LEEME.md`.

## Probada

- `pruebas/recorrido-delicado.js`: todo en verde (18-11-2026, cuando todavía estaba en `v5/`; pasarla a la raíz no cambió su código).
- Capturas en teléfono y escritorio: inicio, búsqueda, entrar a un chat, pasar de un chat a otro y volver; sin errores de consola ni pedidos rechazados.
- En un iPhone real, anclada al inicio (18-11-2026, ya publicada): las pestañas quedaban flotando a media pantalla, con un hueco abajo. iOS le informa a la app anclada una pantalla más corta que la real (le descuenta la barra de estado). Se corrigió en `app.js` («faltaAbajo»): **falta confirmarlo en el teléfono.** La cuenta está comprobada con el caso simulado de `pruebas/dispositivos.js`.
- Ronda por once tamaños de pantalla (`pruebas/dispositivos.js`), en verde.
- Del resto de lo que pide un teléfono real (teclado, micrófono, adjuntar) no se probó nada.

## Pendiente

- Los íconos de la app instalada (`icons/`) siguen siendo los de la v2.
- Mavic y OSPEVIC tienen hoy colores casi iguales (dos celestes): sus tarjetas se parecen entre sí. Es de la configuración de cada una, no de esta piel.
