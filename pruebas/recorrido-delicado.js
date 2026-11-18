/*
 * Lo delicado de la app (viene de la v2): un trámite a medio completar, el teclado del teléfono (simulado), la consulta periódica de fondo y ponerse al día al volver.
 *
 * Es una prueba COMO USUARIO: abre la app en un navegador de verdad, toca, escribe y mira qué pasa.
 * Necesita la API de la plataforma y el servidor local corriendo (ver ../LEEME.md) y Playwright:
 *
 *   PLAYWRIGHT=<carpeta de playwright> node pruebas/<este archivo>
 *
 * Variables: URL (por defecto http://127.0.0.1:4550/, la app), SALIDA (carpeta para las capturas; por
 * defecto, una en la carpeta temporal del sistema). Manda mensajes reales a los bots de la base
 * local: cada corrida deja conversaciones de prueba en esa base.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const URL0 = process.env.URL || 'http://127.0.0.1:4550/';
const OUT = process.env.SALIDA || path.join(require('os').tmpdir(), 'webapp-grupo-capturas'); fs.mkdirSync(OUT, { recursive: true });
const fallas = [];
const ok = (cond, msj) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msj); if (!cond) fallas.push(msj); };
const marco = (p, slug) => p.frameLocator(`iframe.marco[src*="e=${slug}"]`);
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

(async () => {
  const b = await chromium.launch();

  // ── 1. Un botón de arranque abre un trámite; con el trámite a medias, la app NO manda texto ──
  console.log('TRÁMITE A MEDIAS');
  let c = await b.newContext(movil), p = await c.newPage();
  const errores = []; p.on('pageerror', (e) => errores.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto(URL0); await p.waitForSelector('#pedidos .tema'); await p.waitForLoadState('networkidle');
  await p.locator('#pedidos .tema', { hasText: 'Autorizar un medicamento' }).tap();
  await p.waitForURL(/\?e=ospevic/);
  await marco(p, 'ospevic').locator('.wcw-gestion, .wcw-m.visitor').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  const hayTramite = await marco(p, 'ospevic').locator('.wcw-gestion').count();
  ok(hayTramite > 0, 'tocar «Autorizar un medicamento» en el inicio abre el trámite dentro del chat de OSPEVIC');
  await p.screenshot({ path: path.join(OUT, '15-tramite.png') });
  const antes = await marco(p, 'ospevic').locator('.wcw-m.visitor').count();
  await p.locator('.pestana', { hasText: 'Inicio' }).tap();
  await p.locator('#consulta-campo').tap();
  await p.locator('#consulta-campo').fill('¿Dónde queda el centro médico?');
  await p.locator('#res-enviar-lista .fila', { hasText: 'OSPEVIC' }).tap();
  await p.locator('#nota-app').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const nota = await p.locator('#nota-app').isVisible() ? await p.locator('#nota-app').innerText() : '';
  ok(/trámite sin terminar/.test(nota), 'con un trámite a medias la app avisa en vez de mandar: «' + nota.slice(0, 90) + '…»');
  ok(await marco(p, 'ospevic').locator('.wcw-m.visitor').count() === antes, 'y no manda nada al chat');
  ok(await marco(p, 'ospevic').locator('.wcw-foot input[type="text"]').inputValue() === '¿Dónde queda el centro médico?', 'la consulta queda escrita en el campo del chat, para mandarla después');
  await p.screenshot({ path: path.join(OUT, '16-tramite-no-envia.png') });
  ok(errores.length === 0, 'sin errores' + (errores.length ? ': ' + errores.slice(0, 2).join(' | ') : ''));
  await c.close();

  // ── 1b. Terminado el trámite, la app vuelve a poder mandar consultas a ese chat ──
  console.log('TRÁMITE TERMINADO');
  c = await b.newContext(movil); p = await c.newPage();
  // El cierre del trámite se simula: el servidor contesta «completa» al primer paso (así no hay que subir una receta).
  await c.route('**/api/web-chat/gestion', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, completa: true, mensaje: 'Listo (simulado).', ticket: null, numero: null, sugerencias: [] }) }));
  await p.goto(URL0); await p.waitForSelector('#pedidos .tema'); await p.waitForLoadState('networkidle');
  await p.locator('#pedidos .tema', { hasText: 'Autorizar un medicamento' }).tap();
  await marco(p, 'ospevic').locator('.wcw-gestion').waitFor({ timeout: 30000 });
  const campos = marco(p, 'ospevic').locator('.wcw-gestion input');
  for (let i = 0; i < await campos.count(); i++) await campos.nth(i).fill(['Prueba Automática', '30111222', '3515551234'][i] || 'x');
  await marco(p, 'ospevic').locator('.wcw-gestion button', { hasText: 'Seguir' }).tap();
  await marco(p, 'ospevic').locator('.wcw-gestion').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  ok(await marco(p, 'ospevic').locator('.wcw-gestion').count() === 0, 'el trámite se cerró');
  const antes2 = await marco(p, 'ospevic').locator('.wcw-m.visitor').count();
  await p.locator('.pestana', { hasText: 'Inicio' }).tap();
  await p.locator('#situaciones .fila', { hasText: 'Salud' }).tap();
  await p.locator('#res-temas-lista .fila', { hasText: 'consulto por odontología' }).tap();
  await marco(p, 'ospevic').locator('.wcw-m.visitor').nth(antes2).waitFor({ timeout: 15000 }).catch(() => {});
  ok(await marco(p, 'ospevic').locator('.wcw-m.visitor').count() === antes2 + 1 && await p.locator('#nota-app').isHidden(), 'con el trámite ya terminado, la consulta siguiente se manda (no queda trabada por un trámite que ya no existe)');
  await c.close();

  // ── 2. El teclado del teléfono (con un visualViewport de mentira) ──
  console.log('TECLADO');
  c = await b.newContext(movil);
  await c.addInitScript(() => {
    if (window.parent !== window) return;
    const vv = new EventTarget();
    vv.height = window.innerHeight; vv.offsetTop = 0; vv.scale = 1;
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.__teclado = (alto, corrida) => { vv.height = alto; vv.offsetTop = corrida || 0; vv.dispatchEvent(new Event('resize')); };
  });
  p = await c.newPage();
  await p.goto(URL0 + '?e=mavic');
  await marco(p, 'mavic').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => window.__teclado(500, 0));
  await p.waitForTimeout(300);
  const conTeclado = await p.evaluate(() => ({ clase: document.getElementById('app').classList.contains('teclado'), alto: Math.round(document.getElementById('app').getBoundingClientRect().height), pestanas: getComputedStyle(document.getElementById('pestanas')).display, marco: Math.round(document.querySelector('iframe.marco.activo').getBoundingClientRect().height) }));
  ok(conTeclado.clase && conTeclado.alto === 500 && conTeclado.pestanas === 'none' && conTeclado.marco === 500, 'con el teclado abierto la app se achica a lo visible, las pestañas se van y el chat ocupa todo: ' + JSON.stringify(conTeclado));
  const f = p.frames().find((x) => /charla\.html\?e=mavic/.test(x.url()));
  const enMarco = await f.evaluate(() => ({ clase: document.documentElement.classList.contains('teclado'), aviso: getComputedStyle(document.querySelector('.wcw-disc')).display, campoAbajo: Math.round(document.querySelector('.wcw-foot').getBoundingClientRect().bottom), alto: window.innerHeight }));
  ok(enMarco.clase && enMarco.aviso === 'none' && enMarco.campoAbajo <= enMarco.alto, 'el chat se entera: esconde el aviso legal y el campo queda a la vista: ' + JSON.stringify(enMarco));
  await p.screenshot({ path: path.join(OUT, '17-teclado.png') });
  await p.evaluate(() => window.__teclado(window.innerHeight, 0));
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('app').classList.contains('teclado') && getComputedStyle(document.getElementById('pestanas')).display !== 'none'), 'al cerrarse el teclado todo vuelve');
  await c.close();

  // ── 3. Sin conexión en vivo: la consulta periódica de fondo se espacia; y ponerse al día al volver ──
  console.log('CONSULTA PERIÓDICA Y PONERSE AL DÍA');
  c = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await c.route('**/socket.io/**', (r) => r.abort());            // el chat no logra conectarse en vivo: cae a consultar cada 4 s
  const pedidos = { ospevic: 0, suvico: 0, config: 0 };
  let contando = false;
  c.on('request', (r) => {
    const u = r.url();
    if (/\/api\/web-chat\/config/.test(u)) pedidos.config++;
    if (!contando || !/\/api\/web-chat\/messages/.test(u)) return;
    const fr = r.frame() && r.frame().url();
    if (/e=ospevic/.test(fr || '')) pedidos.ospevic++; else if (/e=suvico/.test(fr || '')) pedidos.suvico++;
  });
  p = await c.newPage();
  await p.goto(URL0); await p.waitForSelector('#conversaciones .fila'); await p.waitForLoadState('networkidle');
  // Desde la v3 se ve una cosa por vez también en pantalla grande: para escribir otra consulta hay
  // que volver al inicio, y de un chat a otro se pasa por las pestañas (en la v2, por la columna).
  const V = await p.evaluate(() => (window.Comun && window.Comun.VERSION) || 2);
  const irA = (nombre) => (V >= 3 ? p.locator('.pestana', { hasText: nombre }) : p.locator('#conversaciones .fila', { hasText: nombre })).click();
  for (const [slug, nombre, texto] of [['ospevic', 'OSPEVIC', '¿Dónde está mi credencial?'], ['suvico', 'SUVICO', '¿Cómo me afilio a SUVICO?']]) {
    if (V >= 3 && await p.locator('#inicio').isHidden()) await p.locator('.pestana', { hasText: 'Inicio' }).click();
    await p.locator('#consulta-campo').fill(texto);
    await p.locator('#res-temas-lista .fila').first().click();
    await p.waitForURL(new RegExp('e=' + slug));
    await marco(p, slug).locator('.wcw-m.bot:not(.wcw-welcome)').first().waitFor({ timeout: 90000 });
  }
  await p.waitForTimeout(6000);          // que arranque la consulta periódica en los dos
  contando = true;
  await p.waitForTimeout(32000);
  contando = false;
  console.log('   pedidos de mensajes en 32 s — el que se ve (SUVICO):', pedidos.suvico, '· el de fondo (OSPEVIC):', pedidos.ospevic);
  ok(pedidos.suvico >= 6, 'el chat que se está viendo consulta a su ritmo (cada 4 s)');
  ok(pedidos.ospevic <= 3, 'el de fondo se espacia (uno cada 20 s en vez de cada 4)');
  // Se miran las dos conversaciones: lo que haya llegado mientras no se veían pasa a estar visto.
  // (Una respuesta larga llega en varias burbujas; las últimas pueden caer cuando ya se cambió de chat,
  // y ese aviso es legítimo. Lo que se prueba después es que RECARGAR no invente avisos.)
  await irA('OSPEVIC'); await p.waitForTimeout(900);
  await irA('SUVICO'); await p.waitForTimeout(900);
  ok(await p.locator('.punto').count() === 0, 'miradas las dos conversaciones, no queda ningún punto');
  // Ponerse al día: el marco se recarga y vuelve a quedar igual
  const antesCfg = pedidos.config;
  await p.evaluate(() => { window.__holas = 0; window.addEventListener('message', (e) => { if (e.data && e.data.tipo === 'hola') window.__holas++; }); document.querySelectorAll('iframe.marco').forEach((fr) => fr.contentWindow.postMessage({ app: 'grupo', tipo: 'refrescar' }, location.origin)); });
  await p.waitForFunction(() => window.__holas >= 2, null, { timeout: 20000 }).catch(() => {});
  await marco(p, 'suvico').locator('.wcw-m.visitor').first().waitFor({ timeout: 30000 });
  await marco(p, 'ospevic').locator('.wcw-m.visitor').first().waitFor({ timeout: 30000 });
  ok(await p.evaluate(() => window.__holas) >= 2, 'al pedirles que se pongan al día, los dos chats se recargan');
  ok((await marco(p, 'suvico').locator('.wcw-body').innerText()).includes('afilio'), 'y cada uno vuelve con su conversación');
  ok(pedidos.config === antesCfg, 'sin volver a pedir la configuración (pedidos de más: ' + (pedidos.config - antesCfg) + ')');
  await p.waitForTimeout(1500);
  ok(await p.locator('#novedad').isHidden() && await p.locator('.punto').count() === 0, 'y sin avisos falsos de «te contestaron»');
  // Con algo escrito a medias NO se recarga
  await marco(p, 'suvico').locator('.wcw-foot input[type="text"]').fill('estaba escribiendo…');
  await p.evaluate(() => { window.__holas = 0; document.querySelector('iframe.marco.activo').contentWindow.postMessage({ app: 'grupo', tipo: 'refrescar' }, location.origin); });
  await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__holas) === 0 && await marco(p, 'suvico').locator('.wcw-foot input[type="text"]').inputValue() === 'estaba escribiendo…', 'si la persona tenía algo a medio escribir, ese chat no se recarga');
  await c.close();

  // ── 4. Un chat que se está recargando no pierde lo que se le pide; borrar llega a otra ventana ──
  console.log('RECARGA Y DOS VENTANAS');
  c = await b.newContext(movil);
  p = await c.newPage();
  await p.goto(URL0); await p.waitForSelector('#situaciones .fila'); await p.waitForLoadState('networkidle');
  await p.locator('#situaciones .fila', { hasText: 'Familia' }).tap();
  await p.locator('#res-temas-lista .fila', { hasText: 'cubre el servicio de sepelio' }).tap();
  await p.waitForURL(/e=mavic/);
  await marco(p, 'mavic').locator('.wcw-m.bot:not(.wcw-welcome)').first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.locator('.pestana', { hasText: 'Inicio' }).tap();
  await p.locator('#situaciones .fila', { hasText: 'Familia' }).tap();
  // Se le pide al chat que se ponga al día (se recarga) y, sin esperar, la persona elige otra pregunta
  await p.evaluate(() => document.querySelector('iframe.marco').contentWindow.postMessage({ app: 'grupo', tipo: 'refrescar' }, location.origin));
  await p.locator('#res-temas-lista .fila', { hasText: 'incluir a mis padres' }).tap();
  await marco(p, 'mavic').locator('.wcw-m.visitor', { hasText: 'incluir a mis padres' }).waitFor({ timeout: 40000 }).catch(() => {});
  ok(await marco(p, 'mavic').locator('.wcw-m.visitor', { hasText: 'incluir a mis padres' }).count() === 1, 'una consulta pedida justo mientras el chat se recargaba llega igual, una sola vez');
  // Otra ventana de la app en el mismo teléfono
  const q = await c.newPage();
  await q.goto(URL0); await q.waitForSelector('#conversaciones .fila');
  await q.waitForFunction(() => document.querySelectorAll('iframe.marco').length === 1, null, { timeout: 15000 }).catch(() => {});
  ok((await q.locator('#conv-rotulo').innerText()).toUpperCase() === 'TUS CONVERSACIONES', 'la segunda ventana ve la conversación');
  await p.locator('.pestana', { hasText: 'Inicio' }).tap();
  await p.locator('#consulta-borrar').tap().catch(() => {});
  await p.locator('#inicio').evaluate((n) => { n.scrollTop = n.scrollHeight; });
  await p.locator('#olvidar-abrir').tap();
  await p.locator('#olvidar-ok').tap();
  await q.waitForFunction(() => document.querySelectorAll('iframe.marco').length === 0, null, { timeout: 8000 }).catch(() => {});
  ok(await q.locator('iframe.marco').count() === 0 && (await q.locator('#conv-rotulo').innerText()).toUpperCase() === 'CON QUIÉN HABLAR', 'borrar las conversaciones en una ventana las saca también de la otra');
  ok(await q.evaluate(() => Object.keys(localStorage).filter((k) => /^webchat_(token|consent|origen)_/.test(k)).length === 0), 'y no queda nada del chat guardado en el teléfono');
  await c.close();

  await b.close();
  console.log(fallas.length ? `\n${fallas.length} FALLA(S):\n - ` + fallas.join('\n - ') : '\nTodo en verde.');
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error('SE CORTÓ:', e.message.slice(0, 700)); process.exit(2); });
