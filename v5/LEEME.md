# Web app del grupo — versión 5, «neutra»

La versión 3 sin el color de ninguna entidad. Nació el 18-11-2026: la v3 gustó, pero su inicio se veía como el sitio de Mavic (fondo azul de noche y turquesa), y una app de tres entidades no puede parecer de una. Se pidió conservar el contenido y lo moderno, y sacarle esa identidad.

## Qué cambia respecto de la v3

Sólo la piel. El contenido, la disposición, las animaciones y el comportamiento son los de la v3: `app.js`, `movimiento.js`, `charla.js`, `entidades.js` y `charla.html` son idénticos byte a byte, así que un arreglo de lógica va igual en las tres (v3, v4 y v5).

| | v3 | v5 |
|---|---|---|
| Fondo | Azul de noche (`#051019`) con resplandor turquesa | Grafito (`#0b0d10`) con resplandor claro |
| La luz (acento) | Turquesa | Blanca: botones, foco, pestaña elegida, aviso de «te contestaron» |
| Título | «necesitás?» en turquesa | Dos tonos sin color: «¿Qué» apagado, «necesitás?» encendido |
| Luces de fondo | Turquesa, rojo y celeste | Dos frías y una apenas cálida; ninguna es de una entidad |
| El chat (lo claro) | Papel azulado | Papel gris neutro |

**Dónde sí hay color:** en lo que es de cada entidad. Su tarjeta se enciende con su color, su etiqueta («El sindicato», «La mutual», «La obra social») lo toma, y su logo y el encabezado de su chat son los suyos. El color sale de la configuración de cada chat en la plataforma (`--marca`, que escribe `app.js`); si una entidad cambia el suyo, acá cambia solo.

Archivos que difieren de la v3: `app.css`, `charla.css`, `index.html` (el color de la barra del navegador y un comentario), `manifest.webmanifest`, `sw.js` (nombre de la copia: `grupo-v5`) y `comun.js` (`VERSION = 5`).

## Lo que sigue valiendo de la v3

Todo lo demás: el movimiento y sus reglas, las tipografías (Cabinet Grotesk y Satoshi, en `fuentes/`; la licencia hay que confirmarla antes de publicar), lo que no se probó. Está en `../v3/LEEME.md`. Cómo funciona por dentro, en `../v2/LEEME.md`.

## Probada

- `pruebas/recorrido-delicado.js` contra la v5: todo en verde (18-11-2026).
- Capturas en teléfono y escritorio: inicio, búsqueda, entrar a un chat, pasar de un chat a otro y volver; sin errores de consola ni pedidos rechazados.
- No se probó en teléfonos reales, igual que las demás.

## Pendiente

- Los íconos de la app instalada (`icons/`) siguen siendo los de la v2.
- Mavic y OSPEVIC tienen hoy colores casi iguales (dos celestes): sus tarjetas se parecen entre sí. Es de la configuración de cada una, no de esta piel.
