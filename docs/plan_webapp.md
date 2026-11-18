# Web app del grupo — Suvico · Mavic · Ospevic

Plan de trabajo. Escrito el 17-11-2026 a partir de la propuesta de Matías y de una revisión contra el código de la plataforma. Lo que no se pudo verificar está marcado como tal en la sección 10.

## 1. El problema

Hay afiliados que están en más de una entidad (el sindicato Suvico, la mutual Mavic, la obra social Ospevic). Hoy cada entidad tiene su bot por separado: cuando el afiliado pasa de una a otra, el bot pierde lo que ya contó. Además las tres entidades quieren una sola web app.

## 2. Decisiones tomadas

| Decisión | Detalle |
|---|---|
| Son tres clientes, no uno con marcas | Decidido el 24-09 y confirmado en HU-20 (22-10). Cada entidad conserva su bot, su Biblioteca (RAG), sus intenciones, sus gestiones, sus conectores, su bandeja y sus operadores. |
| La web app es una puerta de entrada común | No junta datos: muestra las entidades y abre el chat de la que el afiliado elige. Cada conversación queda en la bandeja de su entidad. |
| El usuario es el afiliado | No es personal interno. El acceso de un operador a las tres entidades («acceso a nivel grupo») quedó fuera en HU-20 y necesita su propia revisión de seguridad. |
| El afiliado se identifica una sola vez | Con DNI y un código, para las tres entidades (paso 1.2). |
| Vive en una carpeta propia con su subdominio | En su propio repo (`grupo-suvico-web`) desde el 18-11; nació como `` en el repo de la plataforma. No hay backend nuevo: usa la API de la plataforma. |

## 3. Fase 1 — la web app del grupo

Se entrega en tres pasos. Cada uno sirve por sí solo.

### Paso 1.1 — la app, sin login

Se construyó en cinco versiones (17 y 18-11). **Elegida el 18-11: la v5**, que es la app y está en la raíz del repo. Las otras cuatro quedan en `referencia/` (`v1` a `v4`) para consultarlas; la comparación punto por punto está en `referencia/LEEME.md`.

- **v1:** la pantalla «¿Con quién querés hablar?» con tres tarjetas; al elegir una se abre el chat de esa entidad. Usa el chat de la plataforma tal cual.
- **v2:** una sola app con los tres chats vivos adentro. El inicio pregunta «¿Qué necesitás?» y deja buscar por tema o escribir la consulta y elegir a quién mandarla; pasar de una entidad a otra es un toque; avisa cuando contestan en una conversación que no se está mirando.

- **v3 y v4:** la v2 funciona, pero no gustó cómo se ve (sobria y sin movimiento). Son la misma app por dentro con dos pieles nuevas y con animación: la **v3** toma el estilo del sitio de Mavic (de noche, turquesa) y la **v4** el de FitApp (verde bosque, lima y hueso). En las dos se ve una cosa por vez también en la computadora.
- **v5 (18-11):** la v3 gustó, pero su inicio se veía como el sitio de Mavic y la app es de las tres entidades. La **v5** es la v3 con el mismo contenido y el mismo movimiento en una piel neutra: base grafito, luz blanca, y color sólo en lo que es de cada entidad (su tarjeta, su etiqueta, su logo, su chat). **Es la elegida**: sus archivos están en la raíz del repo.

Estado: elegida la v5 (18-11). Anda en local y no está publicada. Falta probarla en teléfonos reales.

### Paso 1.2 — Identidad única

Propuesta de Matías: el afiliado entra con DNI y un código que le llega por WhatsApp o email. El login es del grupo y guarda sólo DNI, teléfono y email. Con el DNI, cada entidad consulta su propio padrón, y la app muestra sólo las entidades donde está afiliado.

Ajustes que salieron de la revisión:

1. **El código no puede salir por WhatsApp desde nuestro lado.** Mandarle el código es escribirle primero al afiliado: exige una plantilla paga de Meta, y el grupo no tiene número propio. Dos caminos sin costo:
   - por email;
   - por WhatsApp al revés: la app muestra un link `wa.me` con el código ya escrito y lo manda el afiliado.
2. **El código va al teléfono o email que figura en el padrón, nunca al que la persona escribe en la pantalla.** El DNI no es secreto: si el código va adonde diga quien está entrando, cualquiera entra con un DNI ajeno.
3. **Las entidades donde está afiliado se muestran después de validar el código**, no antes. Si se muestran con sólo poner un DNI, la pantalla sirve para averiguar quién está afiliado a qué.
4. **Freno por DNI y por conexión** a los intentos de código (el recupero de contraseña de la plataforma ya tiene uno que sirve de modelo).

Qué hay que construir: el login del grupo, la consulta a cada padrón, y la forma de entregarle al chat de cada entidad una identidad ya verificada (hoy el chat web es anónimo).

### Paso 1.3 — Guía pública y pase con resumen

Propuesta de Matías: si el afiliado le pregunta a un bot algo de otra entidad, el bot responde lo general con la guía pública de esa entidad y ofrece pasarlo. Al pasar, el chat nuevo arranca con un resumen de lo que ya dijo.

Ajustes:

1. **La guía pública se lee por referencia, no se copia.** Cada entidad marca en su Biblioteca qué documentos son públicos para el grupo. Los otros bots los consultan como segunda fuente y aclaran de quién es la información. Copiar el contenido de una entidad en la Biblioteca de otra es el modelo que se deshizo el 24-09, y además se desactualiza.
2. **Esto cierra un pendiente del BACKLOG:** la Biblioteca de Grupo Suvico tenía fragmentos de Ospevic. Con la guía pública por referencia, esos fragmentos se sacan.
3. **El afiliado ve el resumen y lo confirma antes de que viaje.** El resumen de una charla con Ospevic puede llevar datos de salud, y Suvico y Mavic no deben recibirlos sin que el afiliado lo decida. Desde Ospevic sólo pasa lo que él aprueba.
4. **El pase crea una conversación nueva en la otra entidad.** Una conversación nunca cambia de entidad: es una regla de la plataforma con test propio (`platform/api/tests/ticket-no-cambia-de-cliente.api.test.js`).

La v2 ya tiene el adelanto manual de este paso: el afiliado escribe su consulta en el inicio y elige a quién mandarla; si no era para ese, se la manda a otro sin escribirla de nuevo. No se copia nada de una conversación a otra.

## 4. Fase 2 — enrutador automático

Propuesta de Matías:

- **En la web app:** detecta de qué entidad es cada mensaje y cambia de bot dentro de la misma conversación («Te atiende Lucas, de Suvico»).
- **En WhatsApp:** el nombre y la foto del chat son siempre los del número, y una entidad no puede escribirle primero a alguien sin una plantilla paga. Por eso se deriva con un toque: el bot de Suvico responde lo general de Mavic y, si el tema es propio de Mavic, manda un link `wa.me` al número de Mavic con un texto ya escrito y un código («Vengo de Suvico, código 4F7K»). El afiliado lo envía y el bot de Mavic recupera el resumen con ese código. Sin costo extra.
- Un solo número para todo el grupo queda para más adelante, si lo deciden las entidades.

Ajustes:

1. **El código del pase va atado al teléfono, sirve una sola vez y vence en minutos.** Cuatro caracteres sueltos se pueden adivinar, y quien adivine uno recibe el resumen de otra persona. En WhatsApp el teléfono es el mismo de los dos lados, así que se puede exigir que coincida.
2. **En la web el cambio de bot se ve como un solo hilo, pero por debajo sigue habiendo una conversación por entidad**, cada una en su bandeja. Es el pase del paso 1.3, automatizado. En la v2, cambiar de bot es mostrar el marco de otra entidad: la estructura ya está.
3. **Ospevic hoy no tiene WhatsApp propio** (sólo chat web): el pase por WhatsApp hacia Ospevic depende de que lo tenga.

## 5. Fase 3 — ficha compartida del afiliado

Por ejemplo, que Mavic vea un reclamo hecho en Ospevic. **No se toca todavía.** Necesita un convenio entre las tres entidades, el consentimiento revocable del afiliado, dejar afuera los datos de salud de Ospevic y la revisión de un abogado. Sin eso rompe la regla de aislamiento entre clientes.

## 6. Qué existe y qué falta

| Pieza | Estado | Dónde |
|---|---|---|
| Tres clientes con bot, Biblioteca, intenciones y gestiones | Existe | Tenants `Grupo Suvico`, `Mavic`, `Ospevic` |
| Chat web de cada entidad | Existe. Es anónimo: la credencial es un token por visitante y por cliente, guardado en el navegador | `platform/api/public/widget.js`, `platform/api/routes/web-chat.js` |
| Grupo que agrupa a los tres | Existe sólo para verlos juntos en Plataforma › Tenants. No da acceso ni comparte datos | `platform/api/lib/tenant-grupos.js`, `docs/qa/core/HU-20/README.md` |
| Padrón de Suvico | Existe: planilla de Google consultada por un conector que valida DNI y nombre | `platform/api/routes/conectores.js` |
| Módulo «Padrón de miembros» | Existe en la plataforma (OP-06) | `platform/api/routes/op-membresias.js` |
| Padrón de Mavic y de Ospevic | Sin verificar | — |
| Login con DNI y código | No existe. El recupero de contraseña por email sirve de base | `platform/api/routes/recuperar-clave.js` |
| Identidad verificada dentro del chat | No existe | — |
| Guía pública entre entidades | No existe | — |
| Pase con resumen | No existe (la v2 tiene el adelanto manual) | — |
| La web app (paso 1.1) | Elegida la v5 (18-11), sin publicar | La raíz del repo; las otras cuatro, en `referencia/` |
| App «Mi protección SUVICO» | Existe en App Store y Google Play y es otro producto (seguridad: mapa de hechos delictivos, alertas, herramientas para vigiladores). La publica un tercero, no es de la plataforma. Detalle abajo | Fichas públicas de las tiendas |

### La app que Suvico ya tiene en las tiendas

Relevada el 17-11-2026 leyendo las fichas públicas de App Store y Google Play, sus capturas y la política de privacidad del sitio de Suvico. **No se la instaló ni se la usó.**

- **Qué es.** «Mi protección SUVICO», una app de seguridad con dos públicos. Para cualquier vecino: declarar ubicaciones y guardar favoritas, recibir alertas de hechos delictivos según la zona, verlos en un mapa, ubicar comisarías, consejos de seguridad y teléfonos útiles. Para vigiladores: administrar objetivos con geolocalización, mostrar su ubicación según la zona y registrar hechos delictivos; además tiene Beneficios, Novedades y Contacto.
- **Quién la publica.** En App Store figura Teledirecto S.A.; en Google Play, una cuenta «Admin APP Suvico». Identificador `com.madProgrammer.suvico`. La política de privacidad nombra a SUVICO como responsable de los datos.
- **En qué estado está.** Versión 1.0.11. App Store da como fecha de publicación el 12-11-2025 y Google Play como última actualización el 2-12-2025: lleva un año sin cambios. Las capturas de la ficha muestran fechas de 2018. Google Play informa «10+ descargas» y en App Store no tiene calificaciones. No se encontró un enlace a la app en el inicio ni en Contacto del sitio de Suvico.
- **Qué datos pide.** Registro propio con nombre, correo, contraseña y teléfono, más la ubicación. La política no nombra DNI ni número de afiliado.
- **Dónde se toca con la web app.** Sólo en Beneficios, Novedades y Contacto, y sólo del lado de Suvico. El mapa, las alertas y los objetivos no están en la web app ni en este plan.

## 7. Paso 1.1 — cómo se hizo y cómo se probó

Cómo está hecha cada versión: `referencia/v1/LEEME.md` y `referencia/v2/LEEME.md`; la elegida, en `docs/la_app.md`.

**Cómo se llegó a la v2.** Después de entregar la v1 se la revisó a fondo, de tres maneras: un estudio del chat de la plataforma tal como corre en producción (para saber hasta dónde se lo puede integrar sin modificarlo), una revisión de experiencia de uso con las capturas del recorrido, y una revisión de código. El veredicto de la revisión de experiencia sobre la v1: prolija como base técnica, pero «un directorio de tres links»: le pide al afiliado justo lo que no sabe (a cuál de las tres le toca su problema), cambiar de entidad recarga la página, y si le contestan más tarde no se entera.

**Probada en local el 17-11**, recorriéndola como usuario en teléfono (390×844) y en escritorio (1366×768), con mensajes reales a los bots:

- el inicio, el buscador («medicamentos» lleva a Ospevic, «préstamo» a Mavic, «farmacia» muestra las dos que tienen el tema) y los temas;
- elegir una pregunta abre el chat correcto y la manda; cada consulta cayó en la bandeja de su entidad;
- estando en Mavic, avisa que contestó Suvico; al entrar, el aviso se va;
- al volver al inicio, la consulta sigue escrita y se la puede mandar a otro;
- con un trámite a medio completar, la app no manda la consulta: avisa y la deja escrita;
- un chat que carga de fondo no le saca el foco a lo que se está escribiendo;
- sin conexión abre igual, avisa y no deja tocar lo que va a fallar;
- al reabrir, los chats con conversación cargan de fondo sin pedir de nuevo la configuración y sin avisos falsos;
- sin conexión en vivo, la consulta periódica del chat de fondo baja de 8 pedidos a 1 en 32 segundos;
- borrar las conversaciones del teléfono saca los chats y sus credenciales.

- al terminar un trámite, la consulta siguiente se manda normalmente;
- una consulta pedida justo mientras un chat se recargaba llega igual, una sola vez;
- con la app abierta en dos ventanas, borrar las conversaciones en una las saca de la otra.

Las pruebas quedaron en `pruebas/` para repetirlas.

**Revisión adversarial de las dos versiones.** Antes de darla por buena, la v2 pasó por una revisión hecha para encontrarle defectos (código, seguridad y privacidad), con un verificador que intentó refutar cada hallazgo leyendo el código. Confirmó 26 y no refutó ninguno:

- **10 en la v1.** Están listados en `referencia/LEEME.md`. La v1 se dejó como estaba, para comparar.
- **12 en la v2, todos corregidos.** Los más importantes: ponerse al día recargaba el chat encima de un formulario a medio llenar; después de terminar un trámite la app seguía creyendo que había uno pendiente; lo que se pedía mandar mientras un chat se recargaba se perdía sin aviso; y «hay algo nuevo» dependía del reloj del teléfono (con el reloj adelantado, la respuesta de una persona podía no avisarse).
- **4 de seguridad y privacidad.** Dos son de la app y están corregidos (el texto de los mensajes de la obra social a la vista en el inicio; «borrar mis conversaciones» no llegaba a otra ventana abierta). Los otros dos son un problema de la plataforma, que está en la sección 9, punto 1.

**Lo que NO se pudo probar acá:** el teclado en un teléfono real (se probó la lógica con un teclado simulado), el micrófono, adjuntar archivos y la instalación en Android e iPhone.

**La v3 y la v4 (17-11).** Se construyeron sobre la lógica de la v2 y se probaron igual: el recorrido completo y los casos delicados, como usuario, en teléfono y escritorio, en verde en las dos. Después pasaron por una revisión independiente (código, diseño contra cada referencia y un verificador que intentó refutar cada hallazgo): de 32 hallazgos confirmó 21, que se corrigieron. Los dos más serios: en la v3 el inicio se volvía a animar a los 2,6 segundos de abrir, y en la v4 las tres tarjetas de entidad se aplastaban en pantallas medianas. Quedó sin probar lo mismo que en la v2 (teléfonos reales) y, además, las transiciones entre vistas fuera de Chrome.

## 8. Pendientes de decisión

1. **Qué versión se publica: resuelto el 18-11, va la v5.** La elección era entre las pieles nuevas: la **v3** (estilo sitio de Mavic), la **v4** (estilo FitApp) y la **v5**, que es la v3 sin el color de ninguna entidad (neutra) y resolvía la objeción a la v3. Por dentro son iguales, así que se eligió por cómo se ve. Sigue pendiente lo que vale para todas las que meten el chat dentro de un marco: el teclado del teléfono pasa a manejarlo la app, y hay que verla en un Android y en un iPhone antes de publicar. La v1 queda como plan B.
2. **Subdominio y marca del grupo.** La app usa un nombre provisorio («Atención al afiliado»).
3. **Padrones de Mavic y de Ospevic:** si existen con DNI y con teléfono o email, y en qué formato. Sin eso no hay paso 1.2 para esas entidades.
4. **Responsable del login del grupo:** qué entidad figura como responsable de los datos que guarda (DNI, teléfono, email) y firma el aviso de privacidad. Hoy el grupo no es un cliente y no tiene datos propios, a propósito.
5. **Qué documentos de cada Biblioteca son «guía pública»** (paso 1.3). Lo decide cada entidad.
6. **Qué lugar ocupa «Mi protección SUVICO»** (sección 6). El vigilador que la tenga va a ver dos apps con el nombre de Suvico. Hay que preguntarle a Suvico si la sigue manteniendo y qué acuerdo tiene con quien la publica. Hasta saberlo: la marca de la web app no debería parecerse a ese nombre, y el login del grupo (paso 1.2) no se puede apoyar en el registro de esa app, que es con correo y contraseña.

## 9. Lo que hay que resolver en la plataforma

Salió de estudiar el chat y el servidor para hacer la app. No es de la app, pero la app lo deja a la vista o lo necesita. De más a menos urgente.

1. **URGENTE, seguridad: la protección de los documentos subidos a la Biblioteca se saltea.** `platform/api/routes/paginas.js` niega `/uploads/kb/…` comparando la dirección tal como llega, pero el servidor de archivos la normaliza después. Con una doble barra (`/uploads//kb/…`), con `%6b` en vez de `k` o con `/./` en el medio, el archivo se entrega sin sesión. Comprobado el 17-11 contra la API local: `/uploads/kb/<cliente>/<archivo>` da 404 y `/uploads//kb/<cliente>/<archivo>` da 200. No se probó contra producción. Tiene dos consecuencias:
   - **Documentos de la Biblioteca de cualquier cliente quedan legibles** para quien tenga la dirección (el nombre del archivo es una huella de su contenido, así que no se adivina, pero circula).
   - **Código ajeno en el dominio del panel.** Al subir un archivo, `platform/api/routes/kb.js` toma la extensión del nombre que manda quien sube cuando el tipo es genérico. Un usuario con permiso de cargar la Biblioteca de cualquier cliente puede subir un `.html`, armar su dirección y mandársela a otra persona: se abre en el dominio del sistema y corre con la sesión de quien lo abra, administrador incluido.
   
   Arreglo propuesto (es del backend, no de la app): en `paginas.js`, decidir sobre la dirección decodificada y normalizada, o directamente sacar `uploads/kb` de la carpeta pública; en `kb.js`, no usar nunca la extensión del nombre; y servir todo `/uploads/` con una cabecera que impida ejecutar código (`Content-Security-Policy: sandbox`). Con un test que pida `/uploads//kb/…` y `/uploads/%6bb/…`. Mientras tanto, **la web app ya no sirve nada subido en su propio dominio** (lo redirige al de la plataforma), así que este agujero no alcanza a las credenciales de las conversaciones del grupo.
2. **El chat de Suvico sigue configurado para las tres entidades.** En producción su configuración dice «Suvico · Ospevic · Mavic» (verificado el 17-11); en la base local además saluda ofreciendo ayuda con las tres y tiene botones de las otras dos («Turnos Ospevic», «Farmacia», «Sepelio»). Con la app mostrando las tres por separado, una consulta de salud puede terminar en la bandeja del sindicato. Hay que acotarlo a Suvico antes de publicar; el reemplazo ordenado es la guía pública del paso 1.3.
3. **Los frenos de la API cuentan por conexión y suman a las tres entidades.** 40 mensajes por minuto por IP entre las tres; 40 pasos de trámite por hora por IP; 20 adjuntos por hora; 12 reclamos por hora. Detrás de la red de un operador de celular salen muchas personas con la misma IP: con unas veinte escribiendo a la vez ya se frenan entre sí, y unos pocos trámites agotan la hora para todos. Para una app pensada para miles de afiliados conviene contar por conversación (el token) y no sólo por IP. (`platform/api/routes/web-chat.js`: `webRateOk`, `publicRateLimit`.)
4. **Mavic no tiene botones de arranque en su chat** (en producción, cero). La app suple con las preguntas de su página, que son una copia. Si Mavic los carga en la plataforma, la app los muestra sola.
5. **No se puede medir cuánto se usa la app.** La app marca cada conversación como venida de `app_grupo`, pero para estas tres entidades (vertical `gremial`) la plataforma descarta ese dato y el ticket no tiene dónde guardarlo. Dos salidas: guardar el origen en el ticket, o darle a la app una clave de chat propia por entidad.
6. **El historial trae los 200 mensajes más viejos, no los últimos** (`ORDER BY m.id ASC LIMIT 200`). En una conversación larga, al recargar no aparece lo más reciente.
7. **Defectos del chat que la v2 esquiva pero siguen para cualquier otro sitio:** si se lo abre antes de que termine de configurarse, pide la configuración dos veces y le quedan duplicados los botones de voz y micrófono (le pasa a la v1); cuando agota los reintentos de conexión en vivo queda consultando cada 4 segundos para siempre, también con la credencial vencida; al reconectar no vuelve a traer lo que llegó durante el corte; mientras consulta así, muestra dos veces cada respuesta del bot (una al recibirla y otra al consultar); «Ahora no» en un trámite lo saca de la vista pero el servidor lo deja pendiente; da por hecho que la página que lo aloja usa `box-sizing: border-box` (en una que no, las tarjetas de trámite se salen 28 px de la pantalla); no tiene modo oscuro.
8. **nginx no pasa la IP real fuera de `/api/`** (`/privacidad/`, `/brands/`, `/uploads/`, `/widget.js`, `/socket.io/`): el freno de `/privacidad/` cuenta a todos como una sola IP. El servidor que publique la app tiene que pasarla en todas.

## 10. Sin verificar al 17-11

- Si el grupo ya está aplicado en producción (`platform/api/scripts/grupo-suvico.js`; al 22-10 no se había corrido) y si la Biblioteca de Grupo Suvico todavía tiene fragmentos de Ospevic (al 25-09 sí).
- Cuánto contenido propio tiene hoy la Biblioteca de Mavic.
- El lado servidor se leyó de la copia local, y **el `main` de esta PC está atrasado respecto de producción**: el `git fetch` a Bitbucket falla por credenciales, y el chat que corre en producción tiene cambios del 05-11 y el 06-11 que acá no están. El chat sí se estudió en su versión de producción (bajada de `app.temacy.ar/widget.js`). La rama `feat/webapp-grupo-20261117` salió del `origin/main` que había en esta PC (`86d13ccf`, del 28-10).
- El teléfono de relleno «351000000» que da el bot de Suvico en local: no se verificó si sigue en producción.
- La configuración del servidor para publicar la app no está en este repo (18-11: desde acá sólo se sube el código). Lo que el servidor tiene que hacer está en `LEEME.md`, «Antes de publicarla».
- De «Mi protección SUVICO» sólo se leyeron las fichas de las tiendas: no se sabe cómo decide que alguien es vigilador (si consulta algún padrón), cuánta gente la usa de verdad ni si Suvico la sigue manteniendo.
