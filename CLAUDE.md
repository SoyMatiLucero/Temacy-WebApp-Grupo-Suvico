# Web app del grupo — Suvico · Mavic · Ospevic

App instalable (PWA) estática, sin framework ni compilación: la puerta de entrada a los chats de las tres entidades (el sindicato SUVICO, la mutual Mavic, la obra social OSPEVIC). Leé `LEEME.md` antes de tocar nada; el plan y las decisiones están en `docs/plan_webapp.md`.

Respondé en español rioplatense. Los documentos, los comentarios y los nombres del código están en español: seguí así.

## Un push a `main` publica en producción

`.github/workflows/deploy-ftp.yml` sube la app por FTP a `https://web.temacy.com/suvico-app/` en cada push a `main`. Entonces:

- **No pushees sin que te lo pidan.** Commitear en local sí, apenas algo esté listo.
- Antes de pushear, probá en local (ver «Probar») y decí qué se va a publicar.
- El workflow publica SÓLO la app: los `.html`, `.js` y `.css` de la raíz, `manifest.webmanifest`, `icons/` y `fuentes/`. Un archivo de la app en otro lugar no se publica si no se suma ahí.
- El repo es público: no escribas en él claves, datos de personas ni detalles de fallas de seguridad sin arreglar.

## Dónde está cada cosa

| | |
|---|---|
| `index.html`, `app.js`, `app.css`, `movimiento.js` | La app: inicio, pestañas, avisos, movimiento. |
| `charla.html`, `charla.js`, `charla.css` | El marco del chat de cada entidad (`charla.html?e=<slug>`). Todo lo que la app sabe del chat por dentro está en `charla.js` (`SEL` y `mirar()`). |
| `comun.js` | Lo que comparten la app y los marcos: guardar en el teléfono, la configuración del chat, dónde está el chat de cada entidad. |
| `entidades.js` | Textos, entidades, temas, preguntas y el script del chat de cada entidad (`guion` + `clave`). Es lo que se toca para cambiar contenido. |
| `sw.js` | Copia sin conexión. **Un archivo nuevo de la app se suma a `ARCHIVOS`**, o los teléfonos no se actualizan. |
| `referencia/` | Las versiones v1 a v4, congeladas. No se arreglan ni se publican. |
| `pruebas/` | Recorridos como usuario con Playwright. |
| `herramientas/` | La imagen para compartir el enlace y su generador. |
| `servidor-local.js` | Para verla en esta máquina. No es parte de la app. |

La app era la carpeta `v5/` hasta el 18-11-2026; por eso `sw.js` dice `grupo-v5` y `comun.js` `VERSION = 5`. No los cambies por prolijidad: `VERSION` es la versión del protocolo entre la app y los marcos y sólo se sube si cambian esos mensajes.

## El chat es de la plataforma, que es otro repo

- La app no tiene backend. El chat (`widget.js`) y su API (`/api/web-chat/`, `/socket.io/`) son de la plataforma. Cuando un documento nombra `platform/…` o `deploy/…`, habla de ese repo. **No lo modifiques desde acá**: si algo hay que cambiar allá, anotalo en `docs/plan_webapp.md` (sección 9) y avisá.
- El chat no se toca por dentro: va en un `<iframe>` del mismo sitio por entidad y se lo maneja por su DOM. Sólo se pisan estilos de tamaño y posición.
- Publicada, la app carga el script de cada entidad directo desde la plataforma (`guion`). En desarrollo (`localhost`, `127.0.0.1`, IP de red local) pide el chat a su mismo sitio y `servidor-local.js` se lo pasa a la API local: así las pruebas hablan con los bots locales y no dejan conversaciones en producción.
- El dominio donde se publica tiene que estar cargado, en la plataforma, como sitio permitido del chat web de cada entidad.

## Reglas de la app que no se negocian

- Cada conversación queda sólo en su entidad. La app no lee una conversación para llevarla a otra.
- OSPEVIC es `reservada`: fuera del chat no se muestra el texto de sus mensajes.
- En el teléfono no se guarda texto de mensajes: sólo una huella de lo último visto.
- Lo que viene de la configuración del chat es texto ajeno: se valida y nunca se mete como HTML.
- Todo el movimiento se apaga con «reducir movimiento», y sin `movimiento.js` no queda nada oculto.

## Verla y probar

Hace falta la API de la plataforma corriendo (en la PC de desarrollo, en el 3110) y Node 20.

```
API=http://127.0.0.1:3110 node servidor-local.js              # la app en http://127.0.0.1:4550
API=http://127.0.0.1:3110 node servidor-local.js referencia   # además v1–v4 (:4510–:4540) y lado a lado (:4505)
```

```
PLAYWRIGHT=<carpeta de playwright> node pruebas/recorrido.js rapido      # sin mandar mensajes
PLAYWRIGHT=<carpeta de playwright> node pruebas/recorrido.js             # manda mensajes reales a los bots locales
PLAYWRIGHT=<carpeta de playwright> node pruebas/recorrido-delicado.js    # trámites, teclado, consulta de fondo
PLAYWRIGHT=<carpeta de playwright> node pruebas/directo.js               # como publicada: el script de cada entidad
```

- Un cambio con interfaz no está terminado con las pruebas en verde: abrí la pantalla, sacá capturas en teléfono y en escritorio y miralas.
- Corré una prueba por vez y no mientras corre otra cosa pesada.
- Los guiones de Node se escriben como archivos, no con heredoc: en Windows un heredoc de Bash hacia `node` pierde las barras invertidas.
- Si movés carpetas con el servidor local corriendo, reinicialo: sigue sirviendo las rutas viejas.

## Agentes del proyecto (`.claude/agents/`)

- `probador` (sonnet): corre las pruebas, mira las capturas y cuenta qué falló. No toca el código.
- `revisor` (opus): busca defectos en un cambio antes de publicarlo y verifica cada hallazgo leyendo el código. No toca el código.
- `lector-del-chat` (opus): contesta cómo se comporta el chat de la plataforma leyendo su código. Sólo lectura.
