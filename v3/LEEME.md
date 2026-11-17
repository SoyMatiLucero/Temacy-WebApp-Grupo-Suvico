# Web app del grupo — versión 2

Una sola app con los chats de las tres entidades vivos adentro. Qué cambia respecto de la v1 y cómo levantarla: `../LEEME.md`. Esto explica cómo está hecha, para quien la tenga que tocar.

No tiene backend propio ni compilación: son archivos estáticos que usan el chat web de la plataforma.

## Las piezas

| Archivo | Para qué |
|---|---|
| `index.html`, `app.js`, `app.css` | **La app**: el inicio (buscador, conversaciones, lo más pedido, temas), las pestañas, los avisos, y los marcos de los chats. |
| `charla.html`, `charla.js`, `charla.css` | **El marco de un chat** (`charla.html?e=suvico`). Carga el chat de la plataforma de esa entidad, lo deja abierto a marco completo y le hace de intermediario con la app. |
| `comun.js` | Lo que comparten los dos: guardar en el teléfono y leer la configuración del chat de cada entidad. |
| `entidades.js` | El nombre de la app, las entidades (con la clave de su chat), los temas del inicio y las preguntas de ejemplo. **Es lo único que se toca para cambiar textos o sumar una entidad.** |
| `sw.js` | Hace que la app abra al toque y sin conexión. No guarda nada de las conversaciones. |
| `manifest.webmanifest`, `icons/` | Lo que la vuelve instalable, con accesos directos a cada entidad. |

## La idea central: un marco por entidad

El chat de la plataforma (`/widget.js`) no se puede desmontar ni poner dos veces en la misma página. Por eso cada entidad tiene su propio marco (un `<iframe>` del mismo sitio): cada uno es un documento aparte con su chat adentro, y la app muestra uno por vez.

Qué se gana:

- **Los chats quedan vivos.** Pasar de uno a otro no recarga nada, y un chat que no se está viendo sigue recibiendo: por eso la app puede avisar «te contestaron».
- **No se mezclan.** Un marco no sabe nada de los otros. La app tampoco lee una conversación para llevarla a otra entidad: lo único que viaja es lo que la persona escribe en el campo del inicio, y adonde ella lo manda.
- **Es la base de lo que sigue** en el plan: el pase de una entidad a otra (1.3) y el cambio de bot dentro de la misma pantalla (fase 2) son, en la web, mostrar otro marco.

Los marcos se crean cuando hacen falta: al elegir una entidad, o al abrir la app si ya había una conversación con ella (de a uno, y nunca con el ahorro de datos del teléfono activado). Una entidad con la que nunca se habló no carga nada.

## Cómo se hablan la app y los marcos

Con mensajes (`postMessage`), siempre validando que vengan del mismo sitio y de la ventana esperada.

| De | A | Mensaje | Qué dice |
|---|---|---|---|
| marco | app | `hola` | Ya cargué y escucho (lleva la versión del protocolo). |
| marco | app | `adios` | Me estoy recargando: hasta el próximo `hola` no escucho. |
| marco | app | `estado` | `cargando`, `listo`, `no` (la entidad no tiene el chat habilitado), `sinred`, `fallo`. |
| marco | app | `mensajes` | El último mensaje, lo último que dijeron ellos (con su hora y una huella), y si la conversación pasó a una persona del equipo. |
| marco | app | `enviado` / `sin-enviar` | Lo que pasó con un pedido de mandar algo. |
| app | marco | `activar` | Sos (o no sos) el chat que se está viendo. |
| app | marco | `teclado` | El teclado del teléfono se abrió o se cerró. |
| app | marco | `enviar` / `arranque` | Mandá esta consulta / tocá este botón de arranque del chat. |
| app | marco | `refrescar` | Ponete al día (se recarga, si la persona no tenía nada a medias). |

Lo que la app pide mandar no se da por hecho hasta que el marco contesta `enviado`. Si el marco se estaba recargando, la app se lo vuelve a pedir cuando saluda; si no pudo abrir el chat, la app avisa que la consulta no se mandó.

Si cambia qué mensajes se mandan o qué significan, hay que subir `VERSION` en `comun.js`: recién publicada una versión puede quedar la app vieja con un marco nuevo, y así la app lo nota y se recarga sola.

## Lo que el marco cuida

El chat está pensado para estar solo en una página. Adentro de la app hay hasta tres a la vez, así que `charla.js` cuida seis cosas:

1. **Abrirlo en el momento justo.** El chat pide su configuración apenas carga. Si se lo abre antes de que llegue, la pide otra vez y le quedan duplicados los botones de voz y de micrófono. El marco espera a que termine.
2. **El foco.** El chat le da el foco a su campo de texto solo. Uno que cargaba de fondo le sacaba el foco a lo que la persona estaba escribiendo en otro lado. Dentro del marco, pedir el foco por programa sólo funciona si ese chat es el que se ve y la persona ya lo está usando; en el teléfono, además, entrar a un chat no abre el teclado.
3. **La voz.** Un chat que no se ve no lee en voz alta.
4. **No mandar texto en mal momento.** Si hay un trámite a medio completar, el servidor toma cualquier texto como la respuesta al paso pendiente. En ese caso (y si el chat está esperando un sí o un no) la consulta que llega desde el inicio no se manda: queda escrita en el campo y la app avisa.
5. **No recargar encima de algo a medias.** Ponerse al día es recargar el marco, y el chat no vuelve a dibujar lo que estaba a medias: un formulario de reclamo, un archivo subiendo, un audio grabándose, el selector de archivos abierto. Si hay algo de eso, no se recarga.
6. **Los pedidos a la plataforma.** La plataforma frena por conexión, sumando a las tres entidades, y detrás de la red de un operador de celular salen muchas personas con la misma dirección. El marco no hace ningún pedido propio: mira los que hace el chat. Le contesta la configuración con la que la app ya tiene fresca (queda un pedido por entidad cada diez minutos) y, cuando el chat no logra conectarse en vivo y cae a consultar cada 4 segundos, espacia la consulta de los chats que no se están viendo (una cada 20 segundos; cada 60 con la app fuera de la vista). Si después de eso el chat vuelve a conectarse, el marco se recarga para no perder lo que haya llegado en el medio.

## «Hay algo nuevo»

La app guarda, por entidad, una huella de lo último que dijeron ellos y que la persona ya vio (la huella, no el texto). Hay novedad si lo último que dijeron es otra cosa.

Se decide por la huella y no por la hora porque el chat mezcla dos relojes: a las respuestas del bot les pone la hora del teléfono, y a las de una persona del equipo y a todo lo que vuelve a traer al recargar, la del servidor. Con el reloj del teléfono adelantado, la respuesta de una persona podía quedar «antes» de lo ya visto y no avisarse nunca.

La huella se saca de todo lo que dijeron de corrido, sin espacios, y sin contar repeticiones: el chat parte una respuesta larga en varias burbujas (que al recargar vuelven como una sola) y, cuando no logra conectarse en vivo, muestra dos veces la misma respuesta.

Es un punto y no un número por lo mismo: contar burbujas diría «3» por una sola respuesta.

La app no puede avisar con la app cerrada (haría falta backend), y lo dice.

## Privacidad

- **La obra social es `reservada`** (en `entidades.js`): lo que se habla con ella puede ser de salud. Fuera del chat, la app no muestra el texto de sus mensajes (sólo «Te contestaron» y la hora) ni deja escrita en el inicio la consulta que se le mandó.
- **En el teléfono queda guardado:** la configuración pública del chat de cada entidad, la huella y la hora de lo último visto, y lo que el propio chat guarda (la credencial de cada conversación). Ningún texto de mensajes.
- **«Borrar mis conversaciones de este teléfono»** saca las credenciales y cierra los chats, también en otra ventana de la app que esté abierta. No borra nada en la entidad, y lo dice.
- **El dominio de la app no sirve nada subido por nadie** (logos, archivos del bot, aviso de privacidad): se redirige al dominio de la plataforma. Ahí están guardadas las credenciales de las tres conversaciones; un archivo subido que se abriera en este dominio podría leerlas. Ver `../nginx-subdominio.ejemplo.conf`, advertencia 4.

## El buscador del inicio

Busca entre lo que cada entidad ya ofrece: los botones de arranque de su chat (se leen de su configuración) y las preguntas de ejemplo de su página (`consultas` en `entidades.js`). No interpreta ni decide: muestra coincidencias, dice de quién es cada una y la persona elige. Si nada coincide, ella elige igual a quién mandarle lo que escribió.

Las `consultas` son una **copia** de las páginas de cada entidad (`platform/api/public/suvico.html`, `mavic.html`, `ospevic.html`). Si una entidad cambia las de su página, hay que cambiarlas acá. Lo ideal es que cada entidad las cargue como botones de arranque de su chat en la plataforma, que la app ya lee sola: hoy Mavic no tiene ninguno.

## El teclado del teléfono

Al abrirse, el navegador no achica la página: dibuja el teclado encima. La app mira cuánta pantalla queda de verdad a la vista (`visualViewport`) y se achica a ese alto; el chat sube con el teclado y las pestañas se esconden. Es la misma cuenta que hace el chat de la plataforma cuando está suelto en una página; acá la hace la app porque el chat, dentro de un marco, ve el alto del marco y no el de la pantalla.

**Esto no se puede probar en una computadora.** Antes de publicar hay que verlo en un Android y en un iPhone. `?depurar=1` dibuja arriba los números (lo visible, la ventana, cuánto se corrió, si detectó el teclado) para mandar una captura.

## De qué depende del chat de la plataforma

Si el chat cambia por dentro, esto es lo que se puede romper. Está todo junto en `charla.js` y `charla.css`.

- **Sus clases** (`SEL`, en `charla.js`): el botón y la ventana (`.wcw-btn`, `.wcw-panel`, `wcw-on`, `wcw-loading`), los mensajes (`.wcw-body`, `.wcw-m`, `visitor`, `operator`, `system`, `wcw-welcome`, `data-at`), el campo y el botón de enviar, los botones de arranque, las cajas con algo a medias (`.wcw-consent-ask`, `.wcw-gestion`, `.wcw-typing`, `.wcw-adj`, `.wcw-rec`, `.wcw-mic`), el encabezado (`.wcw-dot`, `.wcw-subtxt`).
- **Sus respuestas** (`mirar()`, en `charla.js`): `/api/web-chat/config` (el código de respuesta), `/messages` (que traiga `gestion`), `/message` y `/gestion` (`gestion`, `paso`, `completa`, `ya`, `gestion_completa`, `gestion_cancelada`).
- **Lo que se le pisa del aspecto** (`charla.css`): tamaño y posición de la ventana, y se esconden el botón redondo, la cruz y «Ampliar ventana». Además la página mide las cajas con el borde incluido (`box-sizing: border-box`), que es lo que el chat da por hecho.

Si el chat deja de abrirse, el marco muestra «No pudimos abrir el chat» a los quince segundos, con «Reintentar».

Dos cosas a saber:

- **La cruz está escondida.** Hoy ninguna de las tres entidades pide la opinión «al cerrar el chat» (SUVICO la tiene apagada; Mavic y OSPEVIC la piden por mensaje). Si alguna cambia a «al cerrar», esa pregunta no va a aparecer acá.
- **El chat no tiene modo oscuro.** Con el teléfono en oscuro, el inicio es oscuro y el chat es claro. No se fuerza con filtros: rompería logos, fotos y adjuntos.

## Al cambiar algo

- **Textos, entidades, temas, preguntas:** `entidades.js`. El nombre de la app figura además en `manifest.webmanifest` y en `index.html`.
- **Archivos nuevos:** sumarlos a `ARCHIVOS` en `sw.js`, o no van a estar sin conexión. Y al publicar, comprobar que estén todos: si falta uno, la copia guardada de los teléfonos no se actualiza.
- **Un cambio publicado se ve la segunda vez que se abre la app**, no la primera: abre de la copia guardada y se pone al día por detrás.
- **El ícono:** se edita `icons/icon.svg` y se vuelven a generar los tres PNG.
- **Probar:** `../pruebas/recorrido.js` y `../pruebas/recorrido-delicado.js` (ver `../LEEME.md`).
