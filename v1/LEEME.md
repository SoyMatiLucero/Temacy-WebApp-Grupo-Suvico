# Web app del grupo — versión 1

> Esta es la **v1**, tal como se entregó el 17-11-2026. Queda congelada para comparar. La versión vigente y las diferencias están en `../LEEME.md`.

La puerta de entrada común a los chats de las tres entidades. El afiliado elige con quién hablar y se abre el chat de esa entidad. El plan completo (fases, decisiones y pendientes) está en `docs/plan_webapp.md`; esto es el paso 1.1.

No tiene backend propio ni compilación: son archivos estáticos que usan el chat web de la plataforma.

## Qué hay

| Archivo | Para qué |
|---|---|
| `index.html` | La página. Tiene las dos vistas: el inicio (`./`) y el chat de una entidad (`./?e=suvico`, `?e=mavic`, `?e=ospevic`). |
| `entidades.js` | El nombre de la app y las tres entidades con la clave de su chat. **Es lo único que se toca para cambiar textos o sumar una entidad.** |
| `app.js` | La lógica: arma el inicio, carga el chat de la entidad elegida y lo abre. |
| `app.css` | Los estilos (claro y oscuro, según el teléfono). |
| `sw.js` | Hace que la app abra sin conexión. No guarda nada del chat. |
| `manifest.webmanifest`, `icons/` | Lo que la vuelve instalable en el teléfono. |

## Cómo funciona

- **El chat es el de la plataforma, sin tocar.** La página carga `/widget.js` con la clave de la entidad. Todo lo que el chat ya hace (trámites, adjuntos, voz, pase a una persona) funciona igual, y cada conversación cae en la bandeja de su entidad.
- **El nombre del bot, el color y el logo los pone cada entidad** en la plataforma: la app los lee de la configuración de su chat (`/api/web-chat/config`). En `entidades.js` sólo hay un color de reserva.
- **Cambiar de entidad cambia de página.** El chat no se puede desmontar, así que dos entidades en la misma página dejarían dos chats superpuestos.
- **Las conversaciones se guardan por entidad en el dispositivo.** El afiliado puede salir de una, hablar con otra y volver: el inicio marca «Seguir la conversación» en las que ya empezó.
- **Si una entidad no tiene el chat habilitado,** su tarjeta queda como «No disponible por ahora» y las otras siguen andando.

## Probarla en esta máquina

Hace falta la API de la plataforma corriendo. Con Node 20:

```
node servidor-local.js v1
API=http://127.0.0.1:3110 node servidor-local.js v1    # otra API
```

Abre en `http://127.0.0.1:4510`. El servidor local (`../servidor-local.js`) hace lo mismo que nginx va a hacer en el subdominio: sirve esta carpeta y le pasa a la API sólo las rutas del chat.

La base local necesita el chat web de las tres entidades. Las claves de `entidades.js` son las de producción: si en la base local una entidad no tiene esa clave en `web_tenants`, su tarjeta sale como «No disponible por ahora».

## Publicarla (pendiente)

Falta definir el subdominio. Cuando esté:

1. DNS del subdominio a la EC2 y certificado.
2. Un bloque `server` de nginx para el subdominio, con `root` en la carpeta publicada y **sólo estas rutas reenviadas a la API**, copiando las cabeceras de los bloques equivalentes de `deploy/apify/nginx/apify-backend.conf` (sobre todo `Host $host` y las de la IP del visitante, de las que dependen los frenos del chat):

   | Ruta | Qué es |
   |---|---|
   | `/api/web-chat/` | el chat |
   | `/socket.io/` | los mensajes en vivo (con las cabeceras de WebSocket) |
   | `/widget.js` | el chat mismo |
   | `/uploads/` | imágenes y archivos que manda el bot |
   | `/brands/` | logos de las entidades |
   | `/privacidad/` | el aviso de privacidad de cada entidad |

   No incluir el archivo `apify-backend.conf` entero: expondría en este dominio toda la API y las páginas de la plataforma.
3. Un guion de publicación como `deploy/publicar-web.sh` (respaldo, checksums y verificación), que suba todo menos este archivo.
4. Anotar el subdominio en «Chat web» de la ficha de cada entidad. No es obligatorio para que funcione (la API acepta el chat cuando la página y ella están en el mismo dominio), pero deja a la vista dónde está publicado.

## Al cambiar algo

- **Textos o entidades:** `entidades.js`. El nombre de la app figura además en `manifest.webmanifest` y en el `<title>` de `index.html`.
- **Archivos nuevos:** sumarlos a la lista `ARCHIVOS` de `sw.js`, o no van a estar sin conexión.
- **El ícono:** se edita `icons/icon.svg` y se vuelven a generar los tres PNG.
- **Si el chat cambia sus clases** (`.wcw-btn`, `.wcw-panel`, `.wcw-on`, `.wcw-expand`), `app.js` deja de poder abrirlo solo: muestra «No pudimos abrir el chat» a los diez segundos. Son las mismas clases que usan las páginas de cada entidad.
