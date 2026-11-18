# Web app del grupo — Suvico · Mavic · Ospevic

La puerta de entrada común a los chats de las tres entidades: una app instalable hecha de archivos estáticos, sin compilación ni backend propio. El plan completo (fases, decisiones y pendientes) está en `docs/plan_webapp.md`.

Este repo es sólo la app. El chat (`/widget.js`) y su API (`/api/web-chat/`) los sirve la plataforma, que vive en otro repo; cuando un documento de acá nombra `platform/…` o `deploy/…`, habla de ese repo. La app nació ahí como `web_grupo/` y pasó a este repo el 18-11-2026.

## Qué hay

| Carpeta o archivo | Qué es |
|---|---|
| `index.html`, `app.js`, `app.css`, `movimiento.js` | **La app**: el inicio, las pestañas, los avisos, el movimiento. |
| `charla.html`, `charla.js`, `charla.css` | El marco del chat de cada entidad (`charla.html?e=suvico`). |
| `comun.js`, `entidades.js` | Lo que comparten la app y los marcos, y los textos: nombre de la app, entidades, temas y preguntas. |
| `sw.js`, `manifest.webmanifest`, `icons/`, `fuentes/` | Lo que la hace instalable y que abra sin conexión; las tipografías. |
| `docs/la_app.md` | Qué es esta versión y qué le falta. |
| `docs/plan_webapp.md` | El plan. |
| `referencia/` | Las cuatro versiones anteriores (`v1` a `v4`), guardadas para consultarlas. No se mantienen. Qué es cada una y en qué se diferencian: `referencia/LEEME.md`. |
| `pruebas/` | Recorridos de la app como usuario, en un navegador de verdad. |
| `servidor-local.js` | Para verla en esta máquina. |

La app es la versión elegida el 18-11-2026: la quinta que se hizo, la «neutra» (base grafito, luz blanca, y el color sólo en lo que es de cada entidad). Hasta ese día vivía en la carpeta `v5/`; ahora sus archivos están en la raíz del repo. Las carpetas `docs/`, `referencia/` y `pruebas/`, `servidor-local.js` y los `.md` no son parte de la app: son documentos y herramientas de trabajo.

## Verla en esta máquina

Hace falta la API de la plataforma corriendo. Con Node 20:

```
API=http://127.0.0.1:3110 node servidor-local.js
```

Abre en `http://127.0.0.1:4550`.

Con `RED=1` adelante escucha también en la red local, para abrirla desde un teléfono (ahí no hay modo sin conexión ni micrófono: el navegador los reserva para https).

Para tener además las versiones de referencia, cada una en su puerto, y una página que muestra dos lado a lado (como teléfono o como escritorio):

```
API=http://127.0.0.1:3110 node servidor-local.js referencia
```

- v1: `http://127.0.0.1:4510`
- v2: `http://127.0.0.1:4520`
- v3: `http://127.0.0.1:4530`
- v4: `http://127.0.0.1:4540`
- lado a lado: `http://127.0.0.1:4505` (arranca con la v4 y la app, y deja elegir cuáles; también `?a=v3&b=app`)

Con el nombre de una sola (`node servidor-local.js v3`) levanta la app y esa.

## Pruebas

`pruebas/recorrido.js` y `pruebas/recorrido-delicado.js` recorren la app como un usuario, en un navegador de verdad (Playwright), en teléfono y en escritorio, mandando mensajes reales a los bots de la base local.

```
PLAYWRIGHT=<carpeta de playwright> node pruebas/recorrido.js
PLAYWRIGHT=<carpeta de playwright> node pruebas/recorrido-delicado.js
```

Sin `URL` prueban la app (`http://127.0.0.1:4550/`). También sirven para la v2, la v3 y la v4 de referencia: se les pasa la dirección con `URL=` y detectan la versión solas. Con `rapido` al final, el primero no manda mensajes. Cada corrida deja conversaciones de prueba en la base local.

## Antes de publicarla

Este repo guarda el código; la publicación en un servidor no se hace desde acá. Lo que tiene que saber quien la publique:

1. **Qué se publica:** sólo los archivos de la app, en la raíz de un dominio o subdominio propio. Son los de la lista `ARCHIVOS` de `sw.js`, más el propio `sw.js`. No se publican `docs/`, `referencia/`, `pruebas/`, `servidor-local.js` ni los `.md`. Ojo: en el servidor de la plataforma, un subdominio que apunte a la máquina sin su propio bloque de nginx cae en el bloque general y muestra el panel de gestión.
2. **Qué tiene que hacer el servidor:** lo mismo que hace `servidor-local.js`. Sirve los archivos, le reenvía a la API de la plataforma sólo lo que usa el chat (`/api/web-chat/`, `/socket.io/`, `/widget.js`) conservando el `Host` del pedido, y **redirige** al dominio de la plataforma lo que es contenido subido (`/uploads/`, `/brands/`, `/privacidad/`). Esto último es de seguridad y no hay que «simplificarlo» con un reenvío: en el dominio de la app quedan guardadas las credenciales de las tres conversaciones, y ahí no se sirve nada que haya subido nadie.
3. **Que estén todos los archivos** de la lista de `sw.js`: si falta uno, los teléfonos no se actualizan.
4. **Probarla en teléfonos reales**, que todavía no se hizo: teclado, micrófono, adjuntar, instalar, y las transiciones entre vistas en iPhone.
5. **Tipografías:** confirmar la licencia antes de publicar (ver `referencia/v3/LEEME.md`, «Tipografías»: la app usa las mismas).

Lo que hay que resolver en la plataforma, que no es de la app, está en `docs/plan_webapp.md`, sección 9.
