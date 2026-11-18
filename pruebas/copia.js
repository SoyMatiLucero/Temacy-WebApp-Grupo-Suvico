/*
 * La copia sin conexión, y cómo le llega una publicación a un teléfono.
 *
 * En esta máquina la app corre sin sello (`__SELLO__`), y sw.js se porta distinto que publicado.
 * Esta prueba arma en una carpeta temporal la app tal como la deja el deploy —con el sello puesto—,
 * la sirve en /suvico-app/ con un servidor propio que anota cada pedido, y comprueba:
 *   · la primera visita: la copia queda entera y las tipografías no se bajan dos veces;
 *   · las visitas siguientes: no se le pide nada al servidor;
 *   · la segunda bajada, que pasa una sola vez un rato después de instalarse;
 *   · una publicación nueva: se ve la segunda vez que se abre la app, entera y sin mezcla;
 *   · una publicación que agarra al servidor a medio copiar: la mezcla se corrige sola;
 *   · una publicación a medias (sw.js nuevo, páginas viejas): no se instala y sigue la anterior;
 *   · alguien que entra por primera vez justo en una publicación a medias;
 *   · una página sin sello: no traba las actualizaciones;
 *   · sin conexión: la app abre igual.
 * Para saber de qué publicación es cada cosa le agrega una marca a cada archivo de código.
 * A la copia de sw.js le acorta las esperas (diez minutos son demasiado para una prueba).
 *
 * LO QUE ESTO NO VE: corre en Chromium. No prueba Safari, ni el paso desde un service worker de
 * una versión anterior de sw.js, ni una página que queda abierta mientras llega una publicación.
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

// Los archivos de la app: la lista de sw.js (que incluye la página de inicio, sin nombre), más el propio sw.js.
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const DE_LA_LISTA = (/const ARCHIVOS = \[([\s\S]*?)\];/.exec(sw)[1].match(/'[^']*'/g) || []).map((s) => s.slice(1, -1));
const ARCHIVOS = DE_LA_LISTA.filter(Boolean).concat('sw.js');
const ENTRADAS = DE_LA_LISTA.length + 1;      // lo que tiene una copia entera: cada archivo de la lista y la nota

function reemplazar(texto, de, a, archivo) {
  if (texto.indexOf(de) < 0) throw new Error(`No encontré «${de}» en ${archivo}: hay que poner al día esta prueba.`);
  return texto.split(de).join(a);
}
// Deja en la carpeta temporal lo que dejaría el deploy para ese sello. «solo» y «menos» sirven para
// armar publicaciones a medias; «sinSello», para una página a la que le sacaron el sello.
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
    } else if (/\.js$/.test(a)) t += `\n/* publicacion: ${sello} */\n`;
    if (a === 'index.html') t = reemplazar(t, '<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="publicacion" content="${sello}">`, a);
    if (a === 'app.js') t += `window.__publicacion = '${sello}';\n`;
    if (o.sinSello && o.sinSello.indexOf(a) >= 0) t = reemplazar(t, '?v=' + sello, '', a);
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
  console.log('LOS ARCHIVOS DE LA APP');
  const paginas = ARCHIVOS.filter((a) => /\.html$/.test(a));
  const sinSello = paginas.filter((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8').indexOf('?v=__SELLO__') < 0);
  ok(sinSello.length === 0, 'cada página de la lista lleva el sello en lo que carga' + (sinSello.length ? ` (le falta a: ${sinSello.join(', ')}; ver el encabezado de sw.js)` : ` (${paginas.join(', ')})`));

  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${servidor.address().port}${PREFIJO}`;
  const b = await chromium.launch();
  const telefono = await b.newContext({ viewport: { width: 393, height: 852 } });
  const errores = [];

  // Abre la app. «frio»: como quien la abre otro día, con el service worker recién arrancado.
  async function abrir(c, frio) {
    if (frio !== false) {
      const aux = await c.newPage();
      const cdp = await c.newCDPSession(aux);
      await cdp.send('ServiceWorker.enable').catch(() => {});
      await cdp.send('ServiceWorker.stopAllWorkers').catch(() => {});
      await aux.close();
    }
    pedidos = [];
    const p = await c.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(URL0, { waitUntil: 'load' });
    await p.waitForSelector('#conversaciones .fila');
    return p;
  }
  const marcas = (p) => p.evaluate(() => ({ pagina: (document.querySelector('meta[name=publicacion]') || {}).content || '', codigo: window.__publicacion || '', controlada: !!navigator.serviceWorker.controller }));
  // El estado de las copias guardadas: { nombre: { entradas, nota, ajenos } }. «ajenos»: los
  // archivos de código y las páginas que no son de la publicación que da nombre a la copia.
  const copias = (p) => p.evaluate(async (base) => {
    const r = {};
    for (const k of await caches.keys()) {
      const copia = await caches.open(k), nota = await copia.match(base + '__nota'), sello = k.replace('grupo-v5-', ''), ajenos = [];
      const claves = await copia.keys();
      for (const pedido of claves) {
        const ruta = new URL(pedido.url).pathname.slice(base.length);
        const esPagina = ruta === '' || /\.html$/.test(ruta), esCodigo = /\.js$/.test(ruta);
        if (!esPagina && !esCodigo) continue;
        const texto = await (await copia.match(pedido)).text();
        if (texto.indexOf(esPagina ? '?v=' + sello : 'publicacion: ' + sello) < 0) ajenos.push(ruta || '(inicio)');
      }
      r[k] = { entradas: claves.length, nota: nota ? await nota.json() : null, ajenos: ajenos };
    }
    return r;
  }, PREFIJO);
  async function esperar(p, cond, ms) {
    const hasta = Date.now() + (ms || 15000);
    let ultimo;
    while (Date.now() < hasta) { ultimo = await copias(p); if (cond(ultimo)) return ultimo; await dormir(250); }
    return ultimo;
  }
  const de = (cs, sello) => cs['grupo-v5-' + sello];
  // Instalada: es la única copia y tiene todas sus entradas. Entera: además, todo es de su publicación.
  const instalada = (sello) => (cs) => !!de(cs, sello) && de(cs, sello).entradas === ENTRADAS && Object.keys(cs).length === 1;
  const entera = (sello) => (cs) => instalada(sello)(cs) && de(cs, sello).ajenos.length === 0;
  const revisada = (sello) => (cs) => !!(de(cs, sello) && de(cs, sello).nota && de(cs, sello).nota.revisada === true);
  const resumen = (cs) => Object.keys(cs).map((k) => `${k}: ${cs[k].entradas} entradas${cs[k].ajenos.length ? ', de otra publicación: ' + cs[k].ajenos.join(' ') : ''}`).join(' · ') || 'ninguna';
  const veces = (patron) => pedidos.filter((u) => patron.test(u)).length;
  const deLaApp = () => pedidos.filter((u) => !/^sw\.js/.test(u) && !/\[navegación\]$/.test(u));      // sw.js lo revisa el navegador solo
  const exp = (s) => s.replace(/[.\/]/g, '\\$&');

  console.log('PRIMERA VISITA (publicación a)');
  publicar('aaaaaaaa');
  let p = await abrir(telefono);
  let cs = await esperar(p, entera('aaaaaaaa'));
  ok(entera('aaaaaaaa')(cs), `la copia quedó entera, con el nombre de su sello y ${ENTRADAS} entradas (${resumen(cs)})`);
  ok(!!de(cs, 'aaaaaaaa') && !!de(cs, 'aaaaaaaa').nota && de(cs, 'aaaaaaaa').nota.revisada === false, 'la nota dice que falta la segunda bajada');
  const fuentes = ARCHIVOS.filter((a) => /^fuentes\//.test(a));
  ok(fuentes.every((f) => veces(new RegExp('^' + exp(f))) === 1), `cada tipografía se pidió una sola vez (${fuentes.map((f) => veces(new RegExp('^' + exp(f)))).join(', ')})`);
  ok(veces(/^\(inicio\)\?v=aaaaaaaa&r=/) === 1 && veces(/^charla\.html\?v=aaaaaaaa&r=/) === 1 && veces(/^app\.js\?v=aaaaaaaa&r=/) === 1 && veces(/^charla\.js\?v=aaaaaaaa&r=/) === 1, 'las páginas y el código se pidieron derecho al servidor, una vez');
  await p.close();

  console.log('SEGUNDA VISITA, enseguida');
  p = await abrir(telefono);
  await dormir(1500);
  let m = await marcas(p);
  ok(m.controlada && m.pagina === 'aaaaaaaa' && m.codigo === 'aaaaaaaa', `abre de la copia (página ${m.pagina}, código ${m.codigo})`);
  ok(deLaApp().length === 0, `no le pidió nada de la app al servidor (${deLaApp().join(', ') || 'nada'})`);
  await p.close();

  console.log('PASADA LA ESPERA: la segunda bajada');
  await dormir(ESPERA + 500);
  p = await abrir(telefono);
  cs = await esperar(p, revisada('aaaaaaaa'));
  ok(revisada('aaaaaaaa')(cs) && entera('aaaaaaaa')(cs), `la nota quedó como revisada y la copia sigue entera (${resumen(cs)})`);
  ok(veces(/^app\.js\?v=aaaaaaaa&r=/) === 1 && veces(/^charla\.js\?v=aaaaaaaa&r=/) === 1, 'el código se volvió a pedir derecho al servidor, una vez');
  ok(veces(/^fuentes\//) === 0, 'las tipografías no se volvieron a bajar');
  await p.close();
  p = await abrir(telefono);
  await dormir(CADA + 1200);
  ok(deLaApp().length === 0, `y después no pide nada más, con el service worker recién arrancado (${deLaApp().join(', ') || 'nada'})`);
  await p.close();
  p = await abrir(telefono, false);
  await dormir(CADA + 1200);
  ok(deLaApp().length === 0, `ni con el service worker ya andando (${deLaApp().join(', ') || 'nada'})`);
  await p.close();

  console.log('PUBLICACIÓN NUEVA (b)');
  publicar('bbbbbbbb');
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'aaaaaaaa' && m.codigo === 'aaaaaaaa', `la primera vez abre la anterior, entera (página ${m.pagina}, código ${m.codigo})`);
  cs = await esperar(p, entera('bbbbbbbb'));
  ok(entera('bbbbbbbb')(cs), `por detrás quedó la copia nueva, entera, y se borró la anterior (${resumen(cs)})`);
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'bbbbbbbb' && m.codigo === 'bbbbbbbb', `la segunda vez abre la nueva, entera (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('PUBLICACIÓN QUE AGARRA AL SERVIDOR A MEDIO COPIAR (c: todo menos app.js)');
  publicar('cccccccc', { menos: ['app.js'] });
  p = await abrir(telefono);
  cs = await esperar(p, instalada('cccccccc'));
  ok(instalada('cccccccc')(cs) && de(cs, 'cccccccc').ajenos.join() === 'app.js', `la copia c se instaló con el app.js anterior, que era lo que había (${resumen(cs)})`);
  await p.close();
  publicar('cccccccc');                       // el servidor termina de copiar
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'cccccccc' && m.codigo === 'bbbbbbbb', `quedó la mezcla que se esperaba (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  await dormir(ESPERA + 500);
  p = await abrir(telefono);
  cs = await esperar(p, (x) => revisada('cccccccc')(x) && entera('cccccccc')(x));
  ok(revisada('cccccccc')(cs) && entera('cccccccc')(cs), `la segunda bajada pasó y la copia quedó entera (${resumen(cs)})`);
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'cccccccc' && m.codigo === 'cccccccc', `la mezcla se corrigió sola (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('PUBLICACIÓN A MEDIAS (d: sólo llegó sw.js)');
  publicar('dddddddd', { solo: ['sw.js'] });
  p = await abrir(telefono);
  await dormir(4000);
  cs = await copias(p);
  ok(veces(/^sw\.js/) >= 1 && veces(/^index\.html\?v=dddddddd&r=/) >= 1, 'intentó instalar la d (pidió sw.js y las páginas con el sello nuevo)');
  ok(!de(cs, 'dddddddd') && entera('cccccccc')(cs), `la d no se instaló y sigue la c, entera (${resumen(cs)})`);
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.controlada && m.pagina === 'cccccccc' && m.codigo === 'cccccccc', `la app sigue abriendo la c (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  publicar('dddddddd');                       // llega el resto
  p = await abrir(telefono);
  cs = await esperar(p, entera('dddddddd'));
  ok(entera('dddddddd')(cs), `cuando llega el resto, la d se instala entera (${resumen(cs)})`);
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'dddddddd' && m.codigo === 'dddddddd', `y se ve a la vez siguiente (página ${m.pagina}, código ${m.codigo})`);
  await p.close();

  console.log('ALGUIEN QUE ENTRA POR PRIMERA VEZ EN UNA PUBLICACIÓN A MEDIAS (e: faltan charla.html y charla.js)');
  publicar('eeeeeeee', { menos: ['charla.html', 'charla.js'] });
  const nuevo = await b.newContext({ viewport: { width: 393, height: 852 } });
  p = await abrir(nuevo);
  await dormir(4000);
  cs = await copias(p);
  ok(veces(/^charla\.js\?v=eeeeeeee/) >= 1 && Object.keys(cs).length === 0, `intentó instalar la e y no quedó ninguna copia (${resumen(cs)})`);
  await p.close();
  publicar('eeeeeeee');                       // llega el resto
  p = await abrir(nuevo);
  cs = await esperar(p, entera('eeeeeeee'));
  ok(entera('eeeeeeee')(cs), `cuando llega el resto se instala, y todo es de la e: nada quedó del intento anterior (${resumen(cs)})`);
  await p.close();
  await nuevo.close();

  console.log('UNA PÁGINA SIN SELLO (f: a charla.html se lo sacaron)');
  publicar('ffffffff', { sinSello: ['charla.html'] });
  p = await abrir(telefono);
  cs = await esperar(p, instalada('ffffffff'));
  ok(instalada('ffffffff')(cs) && de(cs, 'ffffffff').ajenos.join() === 'charla.html', `la f se instala igual: no traba las actualizaciones (${resumen(cs)})`);
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'ffffffff' && m.codigo === 'ffffffff', `y se ve a la vez siguiente (página ${m.pagina}, código ${m.codigo})`);

  // Para lo que sigue: tocar la copia a mano, como si el teléfono hubiera borrado algo.
  const tocar = (pag, que, dato) => pag.evaluate(async (a) => {
    const nombre = (await caches.keys())[0], copia = await caches.open(nombre);
    if (a.que === 'sacar') await copia.delete(a.base + a.dato);
    if (a.que === 'borrar') await caches.delete(nombre);
    if (a.que === 'nota') await copia.put(a.base + '__nota', new Response(JSON.stringify(a.dato), { headers: { 'Content-Type': 'application/json' } }));
  }, { que: que, dato: dato, base: PREFIJO });

  console.log('A LA COPIA LE FALTA UN ARCHIVO');
  cs = await copias(p);
  const notaAntes = de(cs, 'ffffffff').nota;
  await tocar(p, 'sacar', 'app.css');
  await p.close();
  p = await abrir(telefono);
  cs = await esperar(p, instalada('ffffffff'));
  ok(instalada('ffffffff')(cs), `se arma de nuevo sola (${resumen(cs)})`);
  ok(!!notaAntes && notaAntes.revisada === false && JSON.stringify(de(cs, 'ffffffff').nota) === JSON.stringify(notaAntes), 'y la segunda bajada sigue pendiente, con su fecha');
  await p.close();
  await dormir(ESPERA + 500);
  p = await abrir(telefono);
  cs = await esperar(p, revisada('ffffffff'));
  ok(revisada('ffffffff')(cs), 'que después pasa, como siempre');

  console.log('EL TELÉFONO BORRÓ LA COPIA ENTERA');
  await tocar(p, 'borrar');
  await p.close();
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'ffffffff' && m.codigo === 'ffffffff', `la app abre igual, de la red (página ${m.pagina}, código ${m.codigo})`);
  cs = await esperar(p, instalada('ffffffff'));
  ok(instalada('ffffffff')(cs) && !!de(cs, 'ffffffff').nota && de(cs, 'ffffffff').nota.revisada === false, `y la copia se arma de nuevo, con la segunda bajada pendiente (${resumen(cs)})`);

  console.log('EL RELOJ DEL TELÉFONO ESTABA ADELANTADO');
  await tocar(p, 'nota', { en: Date.now() + 24 * 3600 * 1000, revisada: false });
  await p.close();
  await dormir(CADA + 300);
  p = await abrir(telefono);
  cs = await esperar(p, (x) => !!(de(x, 'ffffffff') && de(x, 'ffffffff').nota && de(x, 'ffffffff').nota.en <= Date.now()), 8000);
  ok(!!de(cs, 'ffffffff').nota && de(cs, 'ffffffff').nota.en <= Date.now() && de(cs, 'ffffffff').nota.revisada === false, 'la espera para la segunda bajada empieza de nuevo, sin saltearla');
  await p.close();

  console.log('SIN CONEXIÓN');
  await telefono.setOffline(true);
  p = await abrir(telefono);
  m = await marcas(p);
  ok(m.pagina === 'ffffffff' && m.codigo === 'ffffffff', `la app abre igual, de la copia (página ${m.pagina}, código ${m.codigo})`);
  await p.close();
  await telefono.setOffline(false);

  ok(errores.length === 0, 'sin errores de la página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await b.close();
  servidor.close();
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) {}
  console.log(fallas ? `\n${fallas} cosa(s) para revisar.` : '\nTodo en orden.');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error(e); try { servidor.close(); } catch (x) {} process.exit(1); });
