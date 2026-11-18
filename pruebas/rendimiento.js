/*
 * Cuánto tarda y cuánto pesa la app: la medición que acompaña a ../backlog.md.
 *
 * Abre la app como un teléfono (393×852, procesador frenado) y anota:
 *   · la primera visita, con la red libre y con una 4G lenta: cuándo aparece algo, cuándo aparece
 *     lo más grande, cuánto se traba, cuánto se mueve la pantalla, cuántos pedidos y cuántos bytes;
 *   · la segunda visita (ya con la copia del service worker), que es abrir la app otro día;
 *   · en reposo, parada en el inicio: cuánto trabaja y cuánto pide sin que nadie toque nada.
 * Y sólo contra una dirección local (para no dejar nada en producción):
 *   · entrar a cada chat: cuánto tarda en quedar listo para escribir y qué baja;
 *   · en reposo con los tres chats abiertos: cuánto consultan.
 *
 * LO QUE ESTO NO VE: es un navegador de computadora con el procesador frenado, no un teléfono. No
 * mide lo que cuesta DIBUJAR (las luces de fondo, el vidrio esmerilado), que corre por la placa de
 * video, ni la batería. Sirve para comparar un antes y un después, no como número absoluto.
 *
 * Necesita Playwright y, para la dirección local, la API de la plataforma y el servidor local:
 *
 *   PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js
 *   URL=https://web.temacy.com/suvico-app/ PLAYWRIGHT=<carpeta de playwright> node pruebas/rendimiento.js
 *
 * Variables: URL (por defecto http://127.0.0.1:4550/), CPU (cuánto frenar el procesador; por
 * defecto 4), VECES (pasadas de cada visita; por defecto 3, y se informa la del medio), SALIDA
 * (carpeta donde deja rendimiento-<sitio>.json, con el detalle de cada pedido).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const URL0 = process.env.URL || 'http://127.0.0.1:4550/';
const CPU = Number(process.env.CPU) || 4;
const VECES = Number(process.env.VECES) || 3;
const OUT = process.env.SALIDA || path.join(require('os').tmpdir(), 'webapp-grupo-capturas');
fs.mkdirSync(OUT, { recursive: true });

const SITIO = new URL(URL0);
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(SITIO.hostname);
const TELEFONO = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// La «4G lenta» de Lighthouse: 1,6 Mb/s de bajada, 750 kb/s de subida, 150 ms de ida y vuelta.
const RED_4G = { offline: false, latency: 150, downloadThroughput: Math.round(1.6 * 1024 * 1024 / 8), uploadThroughput: Math.round(750 * 1024 / 8) };
const ARCHIVOS_DE_LA_COPIA = 19;

// Corre dentro de la página, antes que nada: anota lo que el navegador va informando.
function sondas() {
  if (window.top !== window) return;
  var m = window.__m = { lcp: 0, lcpQue: '', cls: 0, largas: [] };
  function mirar(tipo, f) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(f); }).observe({ type: tipo, buffered: true }); } catch (e) {} }
  mirar('largest-contentful-paint', function (e) {
    m.lcp = e.startTime;
    var n = e.element;
    m.lcpQue = n ? (n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '') + ' «' + (n.textContent || '').trim().slice(0, 30) + '»') : '';
  });
  mirar('layout-shift', function (e) { if (!e.hadRecentInput) m.cls += e.value; });
  mirar('longtask', function (e) { m.largas.push([Math.round(e.startTime), Math.round(e.duration)]); });
  // «Inicio completo»: la última fila de «Con quién hablar» ya está puesta (terminó su entrada).
  m.completo = 0;
  (function mirarFilas() {
    var filas = document.querySelectorAll('#conversaciones > li');
    var ultima = filas[filas.length - 1];
    if (ultima && getComputedStyle(ultima).opacity === '1' && !ultima.getAnimations().some(function (a) { return a.playState === 'running'; })) { m.completo = performance.now(); return; }
    requestAnimationFrame(mirarFilas);
  }());
}

// Anota cada pedido que termina mientras esté puesto (los de la página y los del service worker).
function contar(c) {
  const lista = [], pendientes = [];
  const fin = (req) => pendientes.push((async () => {
    let resp = null, tam = { responseBodySize: 0, responseHeadersSize: 0 };
    try { resp = await req.response(); } catch (e) {}
    try { tam = await req.sizes(); } catch (e) {}
    const t = req.timing();
    lista.push({
      url: req.url(), tipo: req.resourceType(), estado: resp ? resp.status() : 0,
      deLaCopia: !!(resp && resp.fromServiceWorker()), delSW: !!req.serviceWorker(),
      bytes: Math.max(0, tam.responseBodySize) + Math.max(0, tam.responseHeadersSize),
      fin: t.startTime + Math.max(0, t.responseEnd),
    });
  })());
  const fallo = (req) => lista.push({ url: req.url(), tipo: req.resourceType(), estado: -1, deLaCopia: false, delSW: !!req.serviceWorker(), bytes: 0, fin: 0 });
  c.on('requestfinished', fin);
  c.on('requestfailed', fallo);
  return { parar: async () => { c.off('requestfinished', fin); c.off('requestfailed', fallo); await Promise.all(pendientes); return lista; } };
}

function deQuien(u) {
  let url;
  try { url = new URL(u); } catch (e) { return 'otro'; }
  if (/^\/(api|socket\.io|brands|uploads|privacidad)\/|^\/widget\.js$/.test(url.pathname) || (url.origin !== SITIO.origin && /temacy\.ar$/.test(url.hostname))) return 'chat';
  return url.origin === SITIO.origin ? 'app' : 'otro';
}
function resumen(lista) {
  const r = { pedidos: 0, kb: 0, app: { pedidos: 0, kb: 0 }, chat: { pedidos: 0, kb: 0 }, otro: { pedidos: 0, kb: 0 }, delServiceWorker: { pedidos: 0, kb: 0 }, servidosDeLaCopia: 0, sinCambios304: 0, fallidos: 0, consultasDeMensajes: 0 };
  for (const p of lista) {
    if (/^(data|blob):/.test(p.url)) continue;
    if (p.estado === -1) { r.fallidos++; continue; }
    if (p.deLaCopia) { r.servidosDeLaCopia++; continue; }      // no salió a la red
    const kb = p.bytes / 1024;
    r.pedidos++; r.kb += kb;
    const q = r[deQuien(p.url)]; q.pedidos++; q.kb += kb;
    if (p.delSW) { r.delServiceWorker.pedidos++; r.delServiceWorker.kb += kb; }
    if (p.estado === 304) r.sinCambios304++;
    if (/\/api\/web-chat\/messages/.test(p.url)) r.consultasDeMensajes++;
  }
  const red = (o) => { o.kb = Math.round(o.kb * 10) / 10; };
  red(r); red(r.app); red(r.chat); red(r.otro); red(r.delServiceWorker);
  return r;
}
const linea = (r) => `${r.pedidos} pedidos, ${r.kb} kB (app ${r.app.pedidos}/${r.app.kb} kB · chat ${r.chat.pedidos}/${r.chat.kb} kB` +
  (r.otro.pedidos ? ` · otros ${r.otro.pedidos}/${r.otro.kb} kB` : '') + `)` +
  (r.delServiceWorker.pedidos ? ` · de eso, el service worker por detrás: ${r.delServiceWorker.pedidos}/${r.delServiceWorker.kb} kB` : '') +
  (r.servidosDeLaCopia ? ` · ${r.servidosDeLaCopia} servidos de la copia` : '') + (r.sinCambios304 ? ` · ${r.sinCambios304} «sin cambios»` : '') + (r.fallidos ? ` · ${r.fallidos} fallidos` : '');

async function prepararPagina(c, red) {
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (red) await cdp.send('Network.emulateNetworkConditions', red);
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { p, cdp, errores };
}
async function esperarInicio(p) {
  await p.waitForSelector('#conversaciones .fila', { timeout: 90000 });
  await p.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(3500);      // que termine la entrada de la primera vez
}
const copiaCompleta = (p) => p.evaluate(async (n) => {
  if (!('serviceWorker' in navigator) || !window.caches) return false;
  for (let i = 0; i < 80; i++) {
    const claves = await caches.keys();
    for (const k of claves) if ((await (await caches.open(k)).keys()).length >= n) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}, ARCHIVOS_DE_LA_COPIA);

// Una visita al inicio. «conCopia»: esperar a que el service worker termine de guardar todo, para contar lo que baja.
async function visita(c, nombre, red, conCopia) {
  const { p, errores } = await prepararPagina(c, red);
  const cuenta = contar(c);
  await p.goto(URL0, { waitUntil: 'load', timeout: 90000 });
  await esperarInicio(p);
  const m = await p.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
    return { respuesta: nav.responseStart, dom: nav.domContentLoadedEventEnd, cargada: nav.loadEventEnd, fcp: fcp, lcp: window.__m.lcp, lcpQue: window.__m.lcpQue, completo: window.__m.completo, cls: window.__m.cls, largas: window.__m.largas };
  });
  const copia = conCopia ? await copiaCompleta(p) : null;
  const lista = await cuenta.parar();
  const trabado = m.largas.filter((l) => l[0] >= m.fcp).reduce((s, l) => s + Math.max(0, l[1] - 50), 0);
  const r = {
    nombre, respuestaMs: Math.round(m.respuesta), domMs: Math.round(m.dom), cargadaMs: Math.round(m.cargada),
    primeraPinturaMs: Math.round(m.fcp), loMasGrandeMs: Math.round(m.lcp), loMasGrande: m.lcpQue, inicioCompletoMs: Math.round(m.completo),
    corrimiento: Math.round(m.cls * 1000) / 1000, tareasLargas: m.largas.length, trabadoMs: trabado,
    laMasLargaMs: m.largas.reduce((x, l) => Math.max(x, l[1]), 0), red: resumen(lista), copiaCompleta: copia, errores,
    pedidos: lista.map((x) => ({ url: x.url, tipo: x.tipo, estado: x.estado, kb: Math.round(x.bytes / 102.4) / 10, deLaCopia: x.deLaCopia, delSW: x.delSW })),
  };
  console.log(`  responde ${r.respuestaMs} · primera pintura ${r.primeraPinturaMs} · inicio completo ${r.inicioCompletoMs} · lo más grande ${r.loMasGrandeMs} (${r.loMasGrande}) · cargada ${r.cargadaMs} · trabado ${r.trabadoMs} (peor tarea ${r.laMasLargaMs}) · corrimiento ${r.corrimiento}`);
  if (errores.length) console.log(`  ERRORES: ${errores.join(' | ')}`);
  await p.close();
  return r;
}

const mediana = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
// De varias pasadas de lo mismo, la del medio en cada número. El detalle de los pedidos es el de la primera.
function delMedio(nombre, rs) {
  const r = Object.assign({}, rs[0], { pasadas: rs.length });
  ['respuestaMs', 'domMs', 'cargadaMs', 'primeraPinturaMs', 'loMasGrandeMs', 'inicioCompletoMs', 'trabadoMs', 'laMasLargaMs', 'tareasLargas', 'corrimiento'].forEach((k) => { r[k] = mediana(rs.map((x) => x[k])); });
  console.log(`  → ${nombre.toUpperCase()} (la del medio de ${rs.length}): responde ${r.respuestaMs} ms · primera pintura ${r.primeraPinturaMs} ms · inicio completo ${r.inicioCompletoMs} ms · trabado ${r.trabadoMs} ms (peor tarea ${r.laMasLargaMs} ms) · corrimiento ${r.corrimiento}`);
  console.log(`  → ${linea(r.red)}`);
  return r;
}

// Sin tocar nada: cuánto trabaja el hilo principal y cuánto pide. Con el procesador sin frenar.
async function reposo(c, p, cdp, nombre, segundos) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const leer = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const cuenta = contar(c);
  const a = await leer();
  await p.waitForTimeout(segundos * 1000);
  const z = await leer();
  const lista = await cuenta.parar();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const porCiento = (k) => Math.round((z[k] - a[k]) / segundos * 1000) / 10;
  const r = {
    nombre, segundos, hiloPrincipal: porCiento('TaskDuration'), guiones: porCiento('ScriptDuration'), estilos: porCiento('RecalcStyleDuration'), disposicion: porCiento('LayoutDuration'),
    recalculosDeEstilo: z.RecalcStyleCount - a.RecalcStyleCount, memoriaMB: Math.round(z.JSHeapUsedSize / 1048576 * 10) / 10, nodos: z.Nodes, documentos: z.Documents, red: resumen(lista),
  };
  console.log(`\nEN REPOSO, ${nombre.toUpperCase()} (${segundos} s)`);
  console.log(`  hilo principal ocupado ${r.hiloPrincipal} % (guiones ${r.guiones} %, estilos ${r.estilos} %, disposición ${r.disposicion} %) · ${r.recalculosDeEstilo} recálculos de estilo`);
  console.log(`  memoria de guiones ${r.memoriaMB} MB · ${r.nodos} nodos · ${r.documentos} documentos`);
  console.log(`  ${linea(r.red)}` + (r.red.consultasDeMensajes ? ` · ${r.red.consultasDeMensajes} consultas de mensajes` : ''));
  return r;
}

// Entrar a cada chat desde el inicio, sin mandar nada. Sólo contra una dirección local.
async function chats(b) {
  const c = await b.newContext(TELEFONO);
  await c.addInitScript(sondas);
  const { p, cdp, errores } = await prepararPagina(c, null);
  await p.goto(URL0, { waitUntil: 'load' });
  await esperarInicio(p);
  const quieto = [await reposo(c, p, cdp, 'en el inicio, sin ningún chat abierto', 15)];
  const filas = p.locator('#conversaciones .fila');
  const entradas = [];
  for (let i = 0; i < await filas.count(); i++) {
    if (/No disponible|Sin conexión/.test(await filas.nth(i).innerText())) continue;
    const cuenta = contar(c);
    const desde = await p.evaluate(() => performance.now());
    const t0 = Date.now();
    await filas.nth(i).tap();
    await p.waitForURL(/\?e=/);
    const slug = new URL(p.url()).searchParams.get('e');
    await p.frameLocator(`iframe.marco[src*="e=${slug}"]`).locator('.wcw-panel.wcw-on').waitFor({ timeout: 90000 });
    const ms = Date.now() - t0;
    await p.waitForTimeout(3000);      // que termine de pedir lo suyo
    const lista = await cuenta.parar();
    const largas = await p.evaluate((d) => window.__m.largas.filter((l) => l[0] >= d), desde);
    const r = { slug, listoMs: ms, tareasLargas: largas.length, trabadoMs: largas.reduce((s, l) => s + Math.max(0, l[1] - 50), 0), laMasLargaMs: largas.reduce((x, l) => Math.max(x, l[1]), 0), red: resumen(lista) };
    entradas.push(r);
    console.log(`\nENTRAR AL CHAT DE ${slug.toUpperCase()}`);
    console.log(`  listo para escribir en ${r.listoMs} ms · trabado ${r.trabadoMs} ms en ${r.tareasLargas} tareas largas (la peor, ${r.laMasLargaMs} ms)`);
    console.log(`  ${linea(r.red)}`);
    if (i === await filas.count() - 1) quieto.push(await reposo(c, p, cdp, 'en un chat, con los tres abiertos', 30));
    await p.goBack();
    await p.waitForFunction(() => document.getElementById('app').getAttribute('data-vista') === 'inicio');
    await p.waitForTimeout(1000);
  }
  quieto.push(await reposo(c, p, cdp, 'en el inicio, con los tres chats abiertos de fondo', 30));
  if (errores.length) console.log(`  ERRORES: ${errores.join(' | ')}`);
  await c.close();
  return { entradas, quieto, errores };
}

(async () => {
  console.log(`Rendimiento de ${URL0} · teléfono 393×852 · procesador frenado ×${CPU}`);
  const b = await chromium.launch();
  const salida = { url: URL0, cpu: CPU, cuando: new Date().toISOString(), visitas: [], chats: null, quieto: [] };

  let c;
  const libres = [], primeras = [], segundas = [];
  console.log('\nPRIMERA VISITA, RED LIBRE (ms)');
  for (let i = 0; i < VECES; i++) {
    c = await b.newContext(TELEFONO);
    await c.addInitScript(sondas);
    libres.push(await visita(c, 'primera visita, red libre', null, true));
    await c.close();
  }
  salida.visitas.push(delMedio('primera visita, red libre', libres));

  console.log('\nPRIMERA Y SEGUNDA VISITA, 4G LENTA (ms)');
  for (let i = 0; i < VECES; i++) {
    c = await b.newContext(TELEFONO);
    await c.addInitScript(sondas);
    primeras.push(await visita(c, 'primera visita, 4G lenta', RED_4G, true));
    // Abrir la app otro día: la copia ya está, y el service worker arranca de cero (se lo detiene a propósito).
    const auxiliar = await prepararPagina(c, null);
    await auxiliar.cdp.send('ServiceWorker.enable').catch(() => {});
    await auxiliar.cdp.send('ServiceWorker.stopAllWorkers').catch(() => {});
    await auxiliar.p.close();
    segundas.push(await visita(c, 'segunda visita, 4G lenta', RED_4G, false));
    await c.close();
  }
  salida.visitas.push(delMedio('primera visita, 4G lenta', primeras));
  salida.visitas.push(delMedio('segunda visita, 4G lenta', segundas));

  if (LOCAL) {
    const r = await chats(b);
    salida.chats = r.entradas; salida.quieto = r.quieto;
  } else {
    c = await b.newContext(TELEFONO);
    await c.addInitScript(sondas);
    const { p, cdp } = await prepararPagina(c, null);
    await p.goto(URL0, { waitUntil: 'load' });
    await esperarInicio(p);
    salida.quieto.push(await reposo(c, p, cdp, 'en el inicio, sin ningún chat abierto', 15));
    await c.close();
    console.log('\n(No se entra a los chats: no es una dirección local y no se deja nada en producción.)');
  }

  await b.close();
  const archivo = path.join(OUT, `rendimiento-${SITIO.hostname.replace(/[^a-z0-9.-]/gi, '_')}.json`);
  fs.writeFileSync(archivo, JSON.stringify(salida, null, 2));
  console.log(`\nDetalle: ${archivo}`);
})().catch((e) => { console.error(e); process.exit(1); });
