/*
 * El chat cargado con el SCRIPT DE CADA ENTIDAD, directo desde la plataforma (sin servidor en el medio).
 *
 * Publicada, la app carga el script que la plataforma da para cada entidad (`guion` y `clave`, en
 * entidades.js) y el chat le habla a la plataforma de donde vino. En esta máquina eso no pasa nunca
 * (por `127.0.0.1` la app usa `/widget.js` de su mismo sitio: ver comun.js), así que esta prueba
 * arma el caso a mano, SIN tocar producción:
 *
 *   · abre la app con un nombre que no es de desarrollo (`app.prueba`, que el navegador de la
 *     prueba resuelve a esta máquina);
 *   · le cambia el `guion` de cada entidad por el de la API LOCAL (`API`, por defecto :3110);
 *   · corta cualquier pedido que quiera salir a la plataforma de producción, y lo cuenta.
 *
 * Mira: que el script y la configuración se pidan a la plataforma y no al sitio de la app, que los
 * logos (que vienen como ruta) apunten a la plataforma, que un chat abra, y qué pasa con una
 * entidad que NO tiene cargado este sitio como permitido. No manda mensajes.
 *
 * Necesita la API de la plataforma y el servidor local corriendo (ver ../LEEME.md) y Playwright:
 *
 *   PLAYWRIGHT=<carpeta de playwright> node pruebas/directo.js
 *
 * Variables: API (por defecto http://127.0.0.1:3110), PUERTO (el de la app, por defecto 4550),
 * SALIDA (carpeta para las capturas; por defecto, una en la carpeta temporal del sistema).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const API = (process.env.API || 'http://127.0.0.1:3110').replace(/\/+$/, '');
const PUERTO = process.env.PUERTO || '4550';
const APP = `http://app.prueba:${PUERTO}`;
const LOCAL = `http://127.0.0.1:${PUERTO}`;
const PRODUCCION = 'https://app.temacy.ar';
const OUT = process.env.SALIDA || path.join(require('os').tmpdir(), 'webapp-grupo-capturas');
fs.mkdirSync(OUT, { recursive: true });
const fallas = [];
const ok = (cond, msj) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msj); if (!cond) fallas.push(msj); };
const marco = (p, slug) => p.frameLocator(`iframe.marco[src*="e=${slug}"]`);

(async () => {
  const b = await chromium.launch({ args: ['--host-resolver-rules=MAP app.prueba 127.0.0.1'] });
  const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  // ════════ En desarrollo: el chat se pide al mismo sitio ════════
  console.log('EN DESARROLLO (127.0.0.1)');
  let c = await b.newContext(movil);
  let p = await c.newPage();
  await p.goto(LOCAL + '/');
  await p.waitForSelector('#conversaciones .fila');
  const deDesarrollo = await p.evaluate(() => window.Comun.grupo.entidades.map((e) => window.Comun.guionDe(e) + ' ' + window.Comun.plataformaDe(e)));
  ok(deDesarrollo.every((x) => x === '/widget.js '), 'por 127.0.0.1 no usa el script de producción: ' + JSON.stringify(deDesarrollo));
  ok(await p.evaluate(() => window.Comun.grupo.entidades.every((e) => /^https:\/\/[^/]+\/widget\.js$/.test(e.guion) && /^wk_/.test(e.clave))), 'las tres entidades tienen su script (guion https y clave)');
  await c.close();

  // ════════ Publicada: el script de cada entidad, directo ════════
  console.log('DIRECTO (app.prueba → la plataforma en ' + API + ')');
  c = await b.newContext(movil);
  p = await c.newPage();
  const pedidos = { guion: [], config: [], aProduccion: [], alSitio: [], errores: [] };
  p.on('pageerror', (e) => pedidos.errores.push('pageerror: ' + e.message));
  c.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(PRODUCCION)) pedidos.aProduccion.push(u.slice(0, 90));
    if (/\/widget\.js(\?|$)/.test(u)) pedidos.guion.push(u);
    if (/\/api\/web-chat\/config/.test(u)) pedidos.config.push(u);
    if (u.startsWith(APP) && /\/(api|socket\.io|uploads|brands)\/|\/widget\.js/.test(u)) pedidos.alSitio.push(u.slice(0, 90));
  });
  await c.route(PRODUCCION + '/**', (ruta) => ruta.abort());      // nada sale a producción
  await c.route('**/entidades.js', async (ruta) => {
    const r = await ruta.fetch({ url: LOCAL + '/entidades.js' });   // lo pide Node, que no conoce `app.prueba`
    const cuerpo = (await r.text()).split(PRODUCCION + '/widget.js').join(API + '/widget.js');
    await ruta.fulfill({ response: r, body: cuerpo });
  });

  await p.goto(APP + '/');
  await p.waitForSelector('#conversaciones .fila');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(900);

  const directos = await p.evaluate(() => window.Comun.grupo.entidades.map((e) => window.Comun.guionDe(e) + ' ' + window.Comun.plataformaDe(e)));
  ok(directos.every((x) => x === API + '/widget.js ' + API), 'con otro nombre de sitio usa el script de cada entidad: ' + directos[0]);
  ok(pedidos.config.length === 3 && pedidos.config.every((u) => u.startsWith(API + '/')), `la configuración de las tres se pide a la plataforma (${pedidos.config.length})`);

  // Qué entidades dejan pasar a este sitio. En la plataforma, cada chat web tiene su lista de
  // sitios permitidos: la que no tenga cargado éste contesta 403 y la app la muestra «No disponible».
  const lineas = await p.locator('#conversaciones .fila').evaluateAll((filas) => filas.map((f) => f.innerText.replace(/\s+/g, ' ').trim()));
  const disponibles = [], cerradas = [];
  (await p.evaluate(() => window.Comun.grupo.entidades.map((e) => ({ slug: e.slug, nombre: e.nombre, g: window.Comun.configGuardada(e) }))))
    .forEach((e) => (e.g && e.g.no ? cerradas : disponibles).push(e));
  console.log('  disponibles para este sitio: ' + (disponibles.map((e) => e.nombre).join(', ') || 'ninguna') + ' · no lo tienen permitido: ' + (cerradas.map((e) => e.nombre).join(', ') || 'ninguna'));
  ok(disponibles.length > 0, 'al menos una entidad deja pasar a este sitio (si no, no hay nada que probar acá)');
  cerradas.forEach((e) => ok(lineas.some((l) => l.includes(e.nombre) && /No disponible por ahora/.test(l)), `${e.nombre} no tiene permitido este sitio y la app lo dice («No disponible por ahora»)`));

  const logos = await p.locator('#conversaciones .fila img').evaluateAll((imgs) => imgs.map((i) => i.src));
  ok(logos.every((s) => s.startsWith(API + '/') || /^(https:|data:)/.test(s)), `ningún logo se pide al sitio de la app (${logos.length})`);
  // El caso que importa: el logo que la plataforma manda como ruta («/brands/…»), que hay que completar.
  const deRuta = disponibles.filter((e) => e.g && e.g.cfg && String(e.g.cfg.logo).startsWith(API + '/'));
  ok(deRuta.length > 0 && deRuta.every((e) => logos.includes(e.g.cfg.logo)), 'el logo que viene como ruta se ve, pedido a la plataforma: ' + (deRuta.map((e) => e.nombre + ' ' + e.g.cfg.logo).join(' | ') || 'no hubo ninguno'));
  const rotos = await p.locator('#conversaciones .fila img').evaluateAll((imgs) => imgs.filter((i) => i.complete && !i.naturalWidth).length);
  ok(rotos === 0, 'ningún logo roto');
  await p.screenshot({ path: path.join(OUT, 'directo-01-inicio.png') });

  if (disponibles.length) {
    const e = disponibles[0];
    await p.locator('#conversaciones .fila', { hasText: e.nombre }).first().tap();
    await p.waitForURL(new RegExp('\\?e=' + e.slug));
    await marco(p, e.slug).locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
    await p.waitForTimeout(1200);
    const src = await marco(p, e.slug).locator('script[data-key]').first().evaluate((s) => s.src + ' ' + s.getAttribute('data-key'));
    ok(src.startsWith(API + '/widget.js wk_'), `el marco de ${e.nombre} cargó su script desde la plataforma: ${src}`);
    ok(await marco(p, e.slug).locator('.wcw-foot input[type="text"]').isVisible(), 'el chat abrió y se puede escribir');
    ok(pedidos.config.length === 3, `el chat no volvió a pedir la configuración: usó la que la app ya tenía (${pedidos.config.length} pedidos en total)`);
    await p.screenshot({ path: path.join(OUT, 'directo-02-chat.png') });
  }

  ok(pedidos.guion.length > 0 && pedidos.guion.every((u) => u.startsWith(API + '/')), 'el script del chat se pidió sólo a la plataforma');
  ok(pedidos.alSitio.length === 0, 'al sitio de la app no se le pidió nada del chat' + (pedidos.alSitio.length ? ': ' + pedidos.alSitio.join(' | ') : ''));
  ok(pedidos.aProduccion.length === 0, 'nada intentó salir a producción' + (pedidos.aProduccion.length ? ': ' + pedidos.aProduccion.join(' | ') : ''));
  ok(pedidos.errores.length === 0, 'sin errores de la página' + (pedidos.errores.length ? ': ' + pedidos.errores.join(' | ') : ''));

  await b.close();
  console.log(fallas.length ? `\n${fallas.length} FALLA(S):\n - ` + fallas.join('\n - ') : '\nTodo en verde. Capturas en ' + OUT);
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
