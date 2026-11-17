# Web app del grupo — Suvico · Mavic · Ospevic

La puerta de entrada común a los chats de las tres entidades. El plan completo está en `docs/plan_webapp.md`.

Cada versión vive en su carpeta, para poder compararlas:

| Carpeta | Qué es |
|---|---|
| `v1/` | La primera versión (17-11-2026): tres tarjetas y, al elegir una, el chat de esa entidad. Congelada. |
| `v2/` | La versión mejorada. En construcción. |

## Verlas en esta máquina

Hace falta la API de la plataforma corriendo. Con Node 20:

```
API=http://127.0.0.1:3110 node web_grupo/servidor-local.js
```

- v1: `http://127.0.0.1:4510`
- v2: `http://127.0.0.1:4520`
- las dos lado a lado: `http://127.0.0.1:4505`

`servidor-local.js` y `comparar.html` son herramientas de trabajo: no se publican.
