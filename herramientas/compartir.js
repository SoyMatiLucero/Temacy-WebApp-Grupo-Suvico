/*
 * Dibuja la imagen que se ve al compartir el enlace de la app (herramientas/compartir.html) y la
 * guarda en icons/compartir.png, 1200×630. Es la que nombra index.html en `og:image`.
 *
 *   PLAYWRIGHT=<carpeta de playwright> node herramientas/compartir.js
 *
 * No necesita la API ni el servidor local: abre el archivo directo.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const ORIGEN = path.join(__dirname, 'compartir.html');
const DESTINO = path.join(__dirname, '..', 'icons', 'compartir.png');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(ORIGEN).href);
  await p.evaluate(() => document.fonts.ready);
  const fuentes = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight));
  if (fuentes.length < 3) { console.error('No cargaron las tipografías de la app (' + fuentes.join(', ') + '): la imagen saldría con otra letra.'); process.exit(1); }
  await p.screenshot({ path: DESTINO, type: 'png' });
  await b.close();
  console.log('Imagen guardada en ' + DESTINO);
})().catch((e) => { console.error(e); process.exit(2); });
