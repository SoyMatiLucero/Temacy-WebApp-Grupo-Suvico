/*
 * La copia sin conexión, y cómo le llega una publicación a un teléfono.
 *
 * En esta máquina la app corre sin sello (`__SELLO__`), y sw.js se porta distinto que publicado.
 * Esta prueba arma en una carpeta temporal la app tal como la deja el deploy —con el sello puesto—,
 * la sirve en /suvico-app/ con un servidor propio que anota cada pedido, y comprueba:
 *   · la primera visita: la copia queda entera y no se baja dos veces lo que la página ya bajó;
 *   · las visitas siguientes: no se le pide nada al servidor;
 *   · la segunda bajada, que pasa una sola vez un rato después de instalarse;
 *   · una publicación nueva: se ve la segunda vez que se abre la app, entera y sin mezcla;
 *   · una publicación que agarra al servidor a medio copiar: la mezcla se corrige sola;
 *   · una publicación a medias (sw.js nuevo, páginas viejas): no se instala y sigue la anterior;
 *   · sin conexión: la app abre igual.
 * Para saber de qué publicación es cada cosa le agrega una marca a index.html y otra a app.js.
 * A la copia de sw.js le acorta las esperas (diez minutos son demasiado para una prueba).
 *
 * No necesita la API de la plataforma ni el servidor local. Sólo Playwright:
 *
 *   PLAYWRIGHT=<carpeta de playwright> node pruebas/copia.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const RAIZ = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-grupo-copia-'));
const PREFIJO = '/suvico-app/';
const ESPERA = 6000;        // la espera antes de la segunda bajada, acortada
const CADA = 800;

let fallas = 0;
function ok(cond, que) { console.log(`  ${cond ? '✓' : '✗'} ${que}`); if (!cond) fallas++; }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Los archivos de la app: la lista de sw.js, más el propio sw.js.
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const ARCHIVOS = (/const ARCHIVOS = \[([\s\S]*?)\];/.exec(sw)[1].match(/'[^']*'/g) || []).map((s) => s.slice(1, -1)).filter(Boolean).concat('sw.js');

function reemplazar(texto, de, a, archivo) {
  if (texto.indexOf(de) < 0) throw new Error(`No encontré «${de}» en ${archivo}: hay que poner al día esta prueba.`);
  return texto.split(de).join(a);
}
// Deja en la carpeta temporal lo que dejaría el deploy para ese sello. «solo» y «menos» sirven para
// armar publicaciones a medias.
function publicar(sello, opciones) {
  const o = opciones || {};
  for (const a of ARCHIVOS) {
    if (o.solo && o.solo.indexOf(a) < 0) continue;
    if (o.menos && o.menos.indexOf(a) >= 0) continue;
    const destino = path.join(TMP, a);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    if (!/\.(html|js)$/.test(a)) { fs.copyFileSync(path.join(RAIZ, a), destino); continue; }
    let t = fs.readFileSync(path.join(RAIZ, a), 'utf8');
    if (a === 'sw.js' || a === 'index.html' || a === 'charla.html') t = reemplazar(t, '__SELLO__', sello, a);
    if (a === 'sw.js') {
      t = reemplazar(t, 'const ESPERA_MS = 10 * 60 * 1000;', `const ESPERA_MS = ${ESPERA};`, a);
      t = reemplazar(t, 'const CADA_MS = 10 * 60 * 1000;', `const CADA_MS = ${CADA};`, a);
    }
    if (a === 'index.html') t = reemplazar(t, '<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="publicacion" content="${sello}">`, a);
    if (a === 'app.js') t += `\nwindow.__publicacion = '${sello}';\n`;
    fs.writeFileSync(destino, t);
  }
}

// Un servidor que se porta como el hosting: «sin caché» para páginas y código, una semana para lo
// demás, y nunca contesta «no cambió». Anota cada pedido.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
let pedidos = [];
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.indexOf(PREFIJO) !== 0) { res.writeHead(404); return res.end(); }
  const relativa = decodeURIComponent(url.pathname.slice(PREFIJO.length)) || 'index.html';
  const archivo = path.join(TMP, relativa);
  if (archivo.indexOf(TMP) !== 0 || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) { res.writeHead(404); return res.end(); }
  // Cuando el service worker está apagado, Chromium pide la página a la red en paralelo mientras
  // lo arranca (por si tarda), y después usa la de la copia. Ese pedido no lo hace la app: se lo
  // reconoce porque es una navegación, y no se cuenta.
  const delNavegador = req.headers['sec-fetch-mode'] === 'navigate' ? ' [navegación]' : '';
  pedidos.push((url.pathname.slice(PREFIJO.length) || '(inicio)') + url.search + delNavegador);
  const ext = path.extname(archivo), est = fs.statSync(archivo);
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    'Cache-Control': /^\.(html|js|css|webmanifest)$/.test(ext) ? 'no-cache' : 'public, max-age=604800',
    ETag: `"${est.size}-${Math.round(est.mtimeMs)}"`,
    'Last-Modified': est.mtime.toUTCString(),
  });
  fs.createReadStream(archivo).pipe(res);
});

(async () => {
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${servidor.address().port}${PREFIJO}`;
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 393, height: 852 } });
  const errores = [];

  // Abre la app como quien la abre otro día: con el service worker recién arrancado.
  async function abrir() {
    const aux = await c.newPage();
    const cdp = await c.newCDPSession(aux);
    await cdp.send('ServiceWorker.enable').catch(() => {});
    await cdp.send('ServiceWorker.stopAllWorkers').catch(() => {});
    await aux.close();
    pedidos = [];
    const p = await c.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(URL0, { waitUntil: 'load' });
    await p.waitForSelector('#conversaciones .fila');
    return p;
  }
  const marcas = (p) => p.evaluate(() => ({ pagina: (document.querySelector('meta[name=publicacion]') || {}).content || '', codigo: window.__publicacion || '', controlada: !!navigator.serviceWorker.controller }));
  // El estado de las copias guardadas: { nombre: { archivos, nota } }
  const copias = (p) => p.evaluate(async (base) => {
    const r = {};
    for (const k of await caches.keys()) {
      const copia = await caches.open(k), nota = await copia.match(base + '__nota');
      r[k] = { archivos: (await copia.keys()).length, nota: nota ? await nota.json() : null };
    }
    return r;
  }, PREFIJO);
  async function esperar(p, cond, ms) {
    const hasta = Date.now() + (ms || 15000);
    let ultimo;
    while (Date.now() < hasta) { ultimo = await copias(p); if (cond(ultimo)) return ultimo; await dormir(250); }
    return ultimo;
  }
  const lista = (sello) => (cs) => { const x = cs['grupo-v5-' + sello]; return !!x && x.archivos >= ARCHIVOS.length && Object.keys(cs).length === 1; };
  const veces = (patron) => pedidos.filter((u) => patron.test(u)).length;
  const deLaApp = () => pedidos.filter((u) => !/^sw\.js/.test(u) && !/\[navegación\]$/.test(u));      // sw.js lo revisa el navegador solo

  console.log('PRIMERA VISITA (publicación a)');
  publicar('aaaaaaaa');
  let p = await abrir();
  let cs = await esperar(p, lista('aaaaaaaa'));
  ok(lista('aaaaaaaa')(cs), `la copia quedó entera, con el nombre de su sello (${JSON.stringify(Object.keys(cs))})`);
  ok(cs['grupo-v5-aaaaaaaa'] && cs['grupo-v5-aaaaaaaa'].nota && cs['grupo-v5-aaaaaaaa'].nota.revisada === false, 'la nota dice que falta la segunda bajada');
  const fuentes = ARCHIVOS.filter((a) => /^fuentes\//.test(a));
  ok(fuentes.every((f) => veces(new RegExp('^' + f.replace(/[.\/]/g, '\\$&'))) === 1), `cada tipografía se pidió una sola vez (${fuentes.map((f) => veces(new RegExp('^' + f.replace(/[.\/]/g, '\\$&')))).join(', ')})`);
  const codigo = ['app.js', 'app.css', 'comun.js', 'entidades.js', 'movimiento.js'];
  ok(codigo.every((f) => veces(new RegExp('^' + f.replace('.', '\\.') + '\\?')) === 1), `el código que la página ya había bajado no se bajó de nuevo (${codigo.map((f) => veces(new RegExp('^' + f.replace('.', '\\.') + '\\?'))).join(', ')})`);
  ok(veces(/^index\.html\?v=aaaaaaaa&r=/) === 1 && veces(/^charla\.html\?v=aaaaaaaa&r=/) === 1, 'las páginas se pidieron derecho al servidor');
  await p.close();

  console.log('SEGUNDA VISITA, enseguida');
  p = await abrir();
  await dormir(1500);
  let m = await marcas(p);
  ok(m.controlada && m.pagina === 'aaaaaaaa' && m.codigo === 'aaaaaaaa', `abre de la copia (página ${m.pagina}, código ${m.codigo})`);
  ok(deLaApp().length === 0, `no le pidió nada de la app al servidor (${deLaApp().join(', ') || 'nada'})`);
  await p.close();

  console.log('PASADA LA ESPERA: la segunda bajada');
  await dormir(ESPERA + 500);
  p = await abrir();
  cs = await esperar(p, (x) => !!(x['grupo-v5-aaaaaaaa'] && x['grupo-v5-aaaaaaaa'].nota && x['grupo-v5-aaaaaaaa'].nota.revisada));
  ok(cs['grupo-v5-aaaaaaaa'] && cs['grupo-v5-aaaaaaaa'].nota && cs['grupo-v5-aaaaaaaa'].nota.revisada === true, 'la nota quedó como revisada');
  ok(veces(/^app\.js\?v=aaaaaaaa&r=/) === 1 && veces(/^charla\.js\?v=aaaaaaaa&r=/) === 1, 'el código se volvió a pedir derecho al servidor, una vez');
  ok(veces(/^fuentes\//) === 0, 'las tipografías no se volvieron a bajar');
  await p.close();
  p = await abrir();
  await dormir(CADA + 1200);
  ok(deLaApp().length === 0, `y después no pide nada más (${deLaApp().join(', ') || 'nada'})`);
  await p.close();

  console.log('PUBLICACIÓN NUEVA (b)');
  publicar('bbbbbbbb');
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'aaaaaaaa' && m.codigo === 'aaaaaaaa', `la primera vez abre la anterior, entera (página ${m.pagina}, código ${m.codigo})`);
  cs = await esperar(p, lista('bbbbbbbb'));
  ok(lista('bbbbbbbb')(cs), `por detrás quedó la copia nueva y se borró la anterior (${JSON.stringify(Object.keys(cs))})`);
  await p.close();
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'bbbbbbbb' && m.codigo === 'bbbbbbbb', `la segunda vez abre la nueva, entera (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('PUBLICACIÓN QUE AGARRA AL SERVIDOR A MEDIO COPIAR (c: todo menos app.js)');
  publicar('cccccccc', { menos: ['app.js'] });
  p = await abrir();
  cs = await esperar(p, lista('cccccccc'));
  ok(lista('cccccccc')(cs), 'la copia c se instaló (el servidor todavía tenía el app.js anterior)');
  await p.close();
  publicar('cccccccc');                       // el servidor termina de copiar
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'cccccccc' && m.codigo === 'bbbbbbbb', `quedó la mezcla que se esperaba (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  await dormir(ESPERA + 500);
  p = await abrir();
  cs = await esperar(p, (x) => !!(x['grupo-v5-cccccccc'] && x['grupo-v5-cccccccc'].nota && x['grupo-v5-cccccccc'].nota.revisada));
  ok(cs['grupo-v5-cccccccc'] && cs['grupo-v5-cccccccc'].nota && cs['grupo-v5-cccccccc'].nota.revisada === true, 'la segunda bajada pasó');
  await p.close();
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'cccccccc' && m.codigo === 'cccccccc', `y la mezcla se corrigió sola (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('PUBLICACIÓN A MEDIAS (d: sólo llegó sw.js)');
  publicar('dddddddd', { solo: ['sw.js'] });
  p = await abrir();
  await dormir(4000);
  cs = await copias(p);
  ok(!cs['grupo-v5-dddddddd'] && lista('cccccccc')(cs), `la d no se instaló y sigue la c (${JSON.stringify(Object.keys(cs))})`);
  await p.close();
  p = await abrir();
  m = await marcas(p);
  ok(m.controlada && m.pagina === 'cccccccc' && m.codigo === 'cccccccc', `la app sigue abriendo la c, entera (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  publicar('dddddddd');                       // llega el resto
  p = await abrir();
  cs = await esperar(p, lista('dddddddd'));
  ok(lista('dddddddd')(cs), 'cuando llega el resto, la d se instala');
  await p.close();
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'dddddddd' && m.codigo === 'dddddddd', `y se ve a la vez siguiente (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('SIN CONEXIÓN');
  await c.setOffline(true);
  p = await abrir();
  m = await marcas(p);
  ok(m.pagina === 'dddddddd' && m.codigo === 'dddddddd', `la app abre igual, de la copia (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  await c.setOffline(false);

  ok(errores.length === 0, 'sin errores de la página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await b.close();
  servidor.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fallas ? `\n${fallas} cosa(s) para revisar.` : '\nTodo en orden.');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error(e); try { servidor.close(); } catch (x) {} process.exit(1); });
