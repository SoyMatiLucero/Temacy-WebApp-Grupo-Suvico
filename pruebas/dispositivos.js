/*
 * Ronda por tamaños de pantalla: la app en varios teléfonos, tabletas y computadoras.
 *
 * En cada tamaño abre el inicio, lo baja hasta el final y entra a un chat (sin mandar nada), saca
 * una captura de cada cosa y mira lo que se puede medir: que no haya desplazamiento de costado, que
 * la app ocupe justo la pantalla, que las pestañas estén donde van y enteras, que nada se salga de
 * su caja, que el chat no quede tapado por las pestañas y que lo que se toca tenga buen tamaño.
 * Al final arma una hoja por cada vista con todos los tamaños juntos, para mirarlos de una vez.
 *
 * Y un caso aparte, simulado: el iPhone con la app ANCLADA al inicio, donde iOS informa una
 * pantalla más corta que la real (le descuenta la barra de estado). Ahí se comprueba la cuenta
 * que hace app.js para llenar la pantalla igual (ver «faltaAbajo»).
 *
 * LO QUE ESTO NO VE: es un navegador de computadora achicado a cada tamaño, no el teléfono. No
 * muestra lo propio de cada aparato —el teclado de verdad, la app instalada, el micrófono, cómo
 * dibuja Safari—. Para eso hace falta el teléfono en la mano.
 *
 * Necesita la API de la plataforma y el servidor local corriendo (ver ../LEEME.md) y Playwright:
 *
 *   PLAYWRIGHT=<carpeta de playwright> node pruebas/dispositivos.js
 *
 * Variables: URL (por defecto http://127.0.0.1:4550/), SALIDA (carpeta para las capturas).
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const URL0 = process.env.URL || 'http://127.0.0.1:4550/';
const OUT = process.env.SALIDA || path.join(require('os').tmpdir(), 'webapp-grupo-capturas');
fs.mkdirSync(OUT, { recursive: true });

const TELEFONO = { isMobile: true, hasTouch: true };
const DISPOSITIVOS = [
  { id: 'iphone-se', nombre: 'iPhone SE', ancho: 375, alto: 667, dpr: 2, ...TELEFONO },
  { id: 'iphone-15', nombre: 'iPhone 15', ancho: 393, alto: 852, dpr: 3, ...TELEFONO },
  { id: 'iphone-pro-max', nombre: 'iPhone Pro Max', ancho: 430, alto: 932, dpr: 3, ...TELEFONO },
  { id: 'android-chico', nombre: 'Android chico', ancho: 360, alto: 640, dpr: 2, ...TELEFONO },
  { id: 'android-grande', nombre: 'Android grande', ancho: 412, alto: 915, dpr: 2.625, ...TELEFONO },
  { id: 'plegable', nombre: 'Plegable cerrado', ancho: 344, alto: 882, dpr: 3, ...TELEFONO },
  { id: 'telefono-acostado', nombre: 'Teléfono acostado', ancho: 852, alto: 393, dpr: 3, ...TELEFONO },
  { id: 'tableta', nombre: 'Tableta parada', ancho: 820, alto: 1180, dpr: 2, ...TELEFONO },
  { id: 'tableta-acostada', nombre: 'Tableta acostada', ancho: 1180, alto: 820, dpr: 2, ...TELEFONO },
  { id: 'notebook', nombre: 'Notebook', ancho: 1366, alto: 768, dpr: 1 },
  { id: 'monitor', nombre: 'Monitor', ancho: 1920, alto: 1080, dpr: 1 },
];

const fallas = [];
let dispositivo = '';
const ok = (cond, msj) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msj); if (!cond) fallas.push(dispositivo + ': ' + msj); };

// Lo que se puede medir de una vista, sacado de la página.
const medir = () => {
  const r = (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), abajo: Math.round(b.bottom), derecha: Math.round(b.right) }; };
  const visible = (n) => n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden';
  const app = document.getElementById('app'), pestanas = document.getElementById('pestanas');
  // Lo que va en un renglón que se desliza de costado («lo más pedido», en el teléfono) sigue de largo a propósito.
  const enRenglon = (n) => { for (let a = n.parentElement; a && a !== app; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth + 1) return true; return false; };
  const seSalen = [...document.querySelectorAll('#inicio .fila, #inicio .tema, #pestanas .pestana, #inicio h1, #inicio h2')]
    .filter(visible).filter((n) => !enRenglon(n)).filter((n) => { const b = n.getBoundingClientRect(); return b.right > window.innerWidth + 1 || b.left < -1; })
    .map((n) => (n.textContent || '').trim().slice(0, 30));
  const chicos = [...document.querySelectorAll('#inicio a.fila, #inicio button, .pestana, #consulta-campo')]
    .filter(visible).map((n) => ({ t: (n.textContent || n.placeholder || '').trim().slice(0, 24), ...r(n) })).filter((x) => x.h < 44 || x.w < 44)
    .map((x) => `${x.t} ${x.w}×${x.h}`);
  return {
    ancho: window.innerWidth, alto: window.innerHeight,
    deCostado: document.documentElement.scrollWidth > window.innerWidth + 1,
    app: r(app), pestanas: pestanas && visible(pestanas) ? r(pestanas) : null,
    filas: document.querySelectorAll('#conversaciones .fila').length,
    seSalen, chicos,
  };
};

async function recorrer(b, d) {
  dispositivo = d.nombre;
  console.log(`${d.nombre.toUpperCase()} ${d.ancho}×${d.alto}`);
  const c = await b.newContext({ viewport: { width: d.ancho, height: d.alto }, deviceScaleFactor: d.dpr, isMobile: !!d.isMobile, hasTouch: !!d.hasTouch });
  const p = await c.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const tocar = (loc) => (d.hasTouch ? loc.tap() : loc.click());
  const foto = (vista) => p.screenshot({ path: path.join(OUT, `disp-${d.id}-${vista}.png`) });

  await p.goto(URL0);
  await p.waitForSelector('#conversaciones .fila');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(3000);      // que termine la entrada de la primera vez
  let m = await p.evaluate(medir);
  ok(!m.deCostado, 'sin desplazamiento de costado');
  ok(m.app.y === 0 && Math.abs(m.app.h - m.alto) <= 1, `la app ocupa justo la pantalla (${m.app.h} de ${m.alto})`);
  ok(m.filas === 3, 'las tres entidades');
  ok(!!m.pestanas, 'las pestañas están a la vista');
  if (m.pestanas) {
    const pegadaAbajo = m.alto - m.pestanas.abajo, arriba = m.pestanas.y;
    ok(m.pestanas.x >= 0 && m.pestanas.derecha <= m.ancho && m.pestanas.y >= 0 && m.pestanas.abajo <= m.alto, 'las pestañas entran enteras en la pantalla');
    ok((pegadaAbajo >= 4 && pegadaAbajo <= 60) || arriba <= 60, `las pestañas van pegadas a un borde (a ${pegadaAbajo} px de abajo, a ${arriba} de arriba)`);
  }
  ok(m.seSalen.length === 0, 'nada se sale de la pantalla' + (m.seSalen.length ? ': ' + m.seSalen.join(' | ') : ''));
  if (d.hasTouch) ok(m.chicos.length === 0, 'todo lo que se toca mide 44 px o más' + (m.chicos.length ? ': ' + m.chicos.join(' | ') : ''));
  await foto('1-inicio');

  await p.locator('#inicio').evaluate((n) => { n.scrollTop = n.scrollHeight; });
  await p.waitForTimeout(500);
  m = await p.evaluate(medir);
  ok(!m.deCostado && m.seSalen.length === 0, 'abajo de todo tampoco se sale nada' + (m.seSalen.length ? ': ' + m.seSalen.join(' | ') : ''));
  await foto('2-abajo');
  await p.locator('#inicio').evaluate((n) => { n.scrollTop = 0; });

  // Entrar a un chat (la primera entidad disponible), sin mandar nada.
  const filas = p.locator('#conversaciones .fila');
  let elegida = -1;
  for (let i = 0; i < await filas.count(); i++) if (!/No disponible|Sin conexión/.test(await filas.nth(i).innerText())) { elegida = i; break; }
  ok(elegida >= 0, 'hay al menos un chat disponible para entrar');
  if (elegida >= 0) {
    await tocar(filas.nth(elegida));
    await p.waitForURL(/\?e=/);
    const slug = new URL(p.url()).searchParams.get('e');
    await p.frameLocator(`iframe.marco[src*="e=${slug}"]`).locator('.wcw-panel.wcw-on').waitFor({ timeout: 25000 });
    await p.waitForTimeout(1500);
    const caja = await p.locator('iframe.marco.activo').boundingBox();
    const barra = await p.locator('#pestanas').boundingBox();
    ok(!!caja && caja.x >= -1 && caja.y >= -1 && caja.x + caja.width <= d.ancho + 1 && caja.y + caja.height <= d.alto + 1, `el chat entra entero en la pantalla (${caja ? Math.round(caja.width) + '×' + Math.round(caja.height) : 'sin caja'})`);
    if (caja && barra) {
      const seTapan = !(barra.y >= caja.y + caja.height - 1 || barra.y + barra.height <= caja.y + 1 || barra.x >= caja.x + caja.width - 1 || barra.x + barra.width <= caja.x + 1);
      ok(!seTapan, 'las pestañas no tapan el chat');
    }
    const campo = p.frameLocator(`iframe.marco[src*="e=${slug}"]`).locator('.wcw-foot input[type="text"]');
    ok(await campo.isVisible(), 'el campo para escribir está a la vista');
    const minimo = Math.min(320, Math.round(d.alto * 0.5));
    ok(caja && caja.height >= minimo, `al chat le queda lugar (${caja ? Math.round(caja.height) : 0} px de alto; mínimo ${minimo})`);
    await foto('3-chat');
  }
  ok(errores.length === 0, 'sin errores de la página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await c.close();
}

// El iPhone con la app anclada: iOS informa un alto más corto que la pantalla (le descuenta la
// barra de estado) y la app tiene que sumar lo que falta. Se arma el caso con un navegador de
// computadora: una pantalla de 393×852, una ventana que dice medir 59 menos y 59 de barra de estado.
async function iphoneAnclado(b) {
  dispositivo = 'iPhone anclado (simulado)';
  console.log('IPHONE ANCLADO AL INICIO (simulado)');
  const PANTALLA = { width: 393, height: 852 }, BARRA = 59, ABAJO = 34;
  const caso = async (nombre, { anclada, corta }) => {
    const c = await b.newContext({ viewport: { width: PANTALLA.width, height: PANTALLA.height - (corta ? BARRA : 0) }, screen: PANTALLA, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    if (anclada !== undefined) await c.addInitScript((v) => { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => v, configurable: true }); }, anclada);
    const p = await c.newPage();
    let conBarra = true;
    try { await (await c.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: BARRA, bottom: ABAJO } }); } catch (e) { conBarra = false; }
    await p.goto(URL0 + '?depurar=1');
    await p.waitForSelector('#conversaciones .fila');
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const app = document.getElementById('app'), pest = document.getElementById('pestanas').getBoundingClientRect();
      return { alto: Math.round(app.getBoundingClientRect().height), ventana: window.innerHeight, pestanasAbajo: Math.round(pest.bottom), numeros: [...app.children].map((n) => n.textContent).find((t) => /^visible /.test(t)) || '' };
    });
    await c.close();
    return { ...r, conBarra, nombre };
  };

  const roto = await caso('anclada y con el alto corto', { anclada: true, corta: true });
  if (!roto.conBarra) { console.log('  (este navegador no deja simular la barra de estado: no se puede armar el caso)'); return; }
  console.log('  ' + roto.numeros);
  ok(roto.alto === PANTALLA.height, `anclada y con el alto corto: la app llena la pantalla (${roto.alto} de ${PANTALLA.height}; la ventana dice ${roto.ventana})`);
  const lejos = PANTALLA.height - roto.pestanasAbajo;
  ok(lejos >= ABAJO && lejos <= ABAJO + 20, `y las pestañas quedan abajo de todo, sobre la barra de inicio (a ${lejos} px del borde)`);

  const sana = await caso('anclada y con el alto bien', { anclada: true, corta: false });
  ok(sana.alto === PANTALLA.height, `anclada y con el alto bien informado: no suma nada (${sana.alto})`);
  const safari = await caso('en Safari, sin anclar', { anclada: false, corta: true });
  ok(safari.alto === PANTALLA.height - BARRA, `sin anclar (Safari): no suma nada, usa el alto que le informan (${safari.alto})`);
  const android = await caso('en Android', { anclada: undefined, corta: true });
  ok(android.alto === PANTALLA.height - BARRA, `en un teléfono que no es iPhone: no suma nada (${android.alto})`);
}

// Una hoja por vista con todos los tamaños juntos.
async function hojas(b) {
  const p = await (await b.newContext({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 })).newPage();
  for (const vista of ['1-inicio', '2-abajo', '3-chat']) {
    const piezas = DISPOSITIVOS.map((d) => ({ d, archivo: path.join(OUT, `disp-${d.id}-${vista}.png`) })).filter((x) => fs.existsSync(x.archivo));
    if (!piezas.length) continue;
    const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#2a2d33;color:#fff;font:600 13px system-ui;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}figure{margin:0}img{display:block;border:1px solid #555;background:#000}figcaption{margin-top:6px;text-align:center}</style>' +
      piezas.map(({ d, archivo }) => { const alto = d.ancho > d.alto ? 250 : 400; return `<figure><img src="${pathToFileURL(archivo).href}" style="height:${alto}px"><figcaption>${d.nombre} · ${d.ancho}×${d.alto}</figcaption></figure>`; }).join('');
    const hoja = path.join(OUT, `hoja-${vista}.html`);
    fs.writeFileSync(hoja, html);
    await p.goto(pathToFileURL(hoja).href);
    await p.waitForLoadState('networkidle');
    await p.screenshot({ path: path.join(OUT, `hoja-${vista}.png`), fullPage: true });
  }
}

(async () => {
  const b = await chromium.launch();
  const pedidos = process.argv.slice(2);
  const lista = pedidos.length ? DISPOSITIVOS.filter((d) => pedidos.includes(d.id)) : DISPOSITIVOS;
  for (const d of lista) {
    try { await recorrer(b, d); } catch (e) { ok(false, 'no se pudo recorrer: ' + String(e.message || e).split('\n')[0]); }
  }
  if (!pedidos.length || pedidos.includes('iphone-anclado')) {
    try { await iphoneAnclado(b); } catch (e) { ok(false, 'no se pudo armar el caso: ' + String(e.message || e).split('\n')[0]); }
  }
  await hojas(b);
  await b.close();
  console.log(fallas.length ? `\n${fallas.length} FALLA(S):\n - ` + fallas.join('\n - ') : '\nTodo en verde.');
  console.log('Capturas y hojas en ' + OUT);
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
