/*
 * Recorrido completo de la app (la v5): inicio, buscador, temas, chats, avisos de respuesta, sin conexión, borrar conversaciones, escritorio.
 * Sirve también para las de referencia: se le pasa su URL (v2 :4520, v3 :4530, v4 :4540) y detecta la versión sola.
 * Con el argumento `rapido` no manda mensajes (no gasta IA).
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
const OUT = process.env.SALIDA || path.join(require('os').tmpdir(), 'webapp-grupo-capturas');
fs.mkdirSync(OUT, { recursive: true });
const RAPIDO = process.argv.includes('rapido');      // sin mandar mensajes (no gasta IA)
const fallas = [];
const ok = (cond, msj) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msj); if (!cond) fallas.push(msj); };
const foto = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });

async function contexto(b, opts) {
  const c = await b.newContext(opts);
  const p = await c.newPage();
  const reg = { errores: [], config: 0, malos: [] };
  p.on('console', (m) => { if (m.type() === 'error') reg.errores.push(m.text()); });
  p.on('pageerror', (e) => reg.errores.push('pageerror: ' + e.message));
  c.on('request', (r) => { if (/\/api\/web-chat\/config/.test(r.url())) reg.config++; });
  c.on('response', (r) => { if (r.status() >= 400) reg.malos.push(r.status() + ' ' + r.url().replace(/token=[^&]+/, 'token=…').slice(0, 110)); });
  return { c, p, reg };
}
const marco = (p, slug) => p.frameLocator(`iframe.marco[src*="e=${slug}"]`);
async function esperarRespuesta(p, slug, antes) {
  await marco(p, slug).locator('.wcw-m.bot:not(.wcw-welcome), .wcw-m.operator').nth(antes).waitFor({ state: 'attached', timeout: 90000 });
}

(async () => {
  const b = await chromium.launch();

  // ════════ TELÉFONO ════════
  console.log('TELÉFONO 390×844 — primera vez');
  const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  let { c, p, reg } = await contexto(b, movil);
  await p.goto(URL0);
  await p.waitForSelector('#conversaciones .fila');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(900);
  // Qué versión se está probando. Desde la 3 se ve una cosa por vez también en pantalla grande
  // (las pestañas hacen de menú) y el chat puede ir enmarcado: cambian dos comprobaciones.
  const V = await p.evaluate(() => (window.Comun && window.Comun.VERSION) || 2);
  console.log('  versión ' + V);
  ok(await p.locator('#conversaciones .fila').count() === 3, 'tres filas de «con quién hablar»');
  ok((await p.locator('#conv-rotulo').innerText()).toUpperCase() === 'CON QUIÉN HABLAR', 'sin conversaciones el rótulo dice «Con quién hablar»');
  ok(await p.locator('#pedidos .tema').count() >= 4, `«lo más pedido» trae los botones de los chats (${await p.locator('#pedidos .tema').count()})`);
  ok(await p.locator('#situaciones .fila').count() === 5, 'cinco temas');
  ok(await p.locator('.pestana').count() === 4, 'cuatro pestañas');
  ok(await p.locator('iframe.marco').count() === 0, 'sin conversaciones no se abre ningún chat de fondo');
  ok(reg.config === 3, `tres pedidos de configuración al abrir por primera vez (hubo ${reg.config})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin desplazamiento horizontal');
  const chicos = await p.evaluate(() => [...document.querySelectorAll('#inicio a.fila, #inicio button, .pestana, #consulta-campo')].filter((n) => n.offsetParent !== null).map((n) => ({ t: (n.textContent || n.placeholder || '').trim().slice(0, 24), h: Math.round(n.getBoundingClientRect().height), w: Math.round(n.getBoundingClientRect().width) })).filter((x) => x.h < 44 || x.w < 44));
  ok(chicos.length === 0, 'todo lo que se toca mide 44 px o más' + (chicos.length ? ': ' + JSON.stringify(chicos) : ''));
  await foto(p, '01-inicio');
  await p.locator('#inicio').evaluate((n) => { n.scrollTop = n.scrollHeight; });
  await p.waitForTimeout(200);
  await foto(p, '02-inicio-abajo');
  await p.locator('#inicio').evaluate((n) => { n.scrollTop = 0; });

  // Buscar
  await p.locator('#consulta-campo').tap();
  await p.locator('#consulta-campo').fill('medicamentos');
  await p.waitForTimeout(200);
  const temas = await p.locator('#res-temas-lista .fila-nombre').allInnerTexts();
  ok(temas.length > 0 && temas.some((t) => /medic/i.test(t)), 'buscar «medicamentos» encuentra temas: ' + temas.slice(0, 4).join(' | '));
  ok((await p.locator('#res-temas-lista .fila-previa').first().innerText()).includes('OSPEVIC'), 'cada tema dice de quién es');
  ok(await p.locator('#res-enviar-lista .fila').count() === 3, 'y ofrece a quién mandarle lo escrito');
  await foto(p, '03-buscar');
  await p.locator('#consulta-campo').fill('préstamo');
  await p.waitForTimeout(150);
  ok((await p.locator('#res-temas-lista .fila').first().innerText()).includes('Mavic'), '«préstamo» lleva a Mavic');
  await p.locator('#consulta-campo').fill('farmacia');
  await p.waitForTimeout(150);
  const deQuienes = (await p.locator('#res-temas-lista .fila-previa').allInnerTexts()).join(' ');
  ok(/Mavic/.test(deQuienes) && /OSPEVIC/.test(deQuienes), '«farmacia» muestra las dos que tienen el tema, para que elija');
  await p.locator('#consulta-borrar').tap();
  ok(await p.locator('#portada').isVisible(), 'la cruz vuelve al inicio');

  // Un tema → una pregunta → el chat
  await p.locator('#situaciones .fila', { hasText: 'Salud' }).tap();
  await p.waitForTimeout(150);
  ok(await p.locator('#res-temas-lista .fila').count() >= 10, `«Salud y remedios» lista sus preguntas (${await p.locator('#res-temas-lista .fila').count()})`);
  await foto(p, '04-tema-salud');
  if (!RAPIDO) {
    await p.locator('#res-temas-lista .fila', { hasText: 'urgencia' }).first().tap();
    await p.waitForURL(/\?e=ospevic/);
    await marco(p, 'ospevic').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
    await esperarRespuesta(p, 'ospevic', 0);
    await p.waitForTimeout(1200);
    const caja = await p.locator('iframe.marco.activo').boundingBox();
    const barra = await p.locator('#pestanas').boundingBox();
    // Hasta la v2 el chat va de borde a borde; desde la 3 puede llevar un marco fino alrededor.
    const aire = caja && barra ? barra.y - (caja.y + caja.height) : 99;
    ok(caja && barra && (V >= 3 ? caja.y >= 0 && caja.y <= 12 && aire >= -1 && aire <= 16 : Math.abs(aire) < 2 && caja.y === 0), `el chat ocupa de arriba hasta las pestañas (chat ${Math.round(caja.height)} + pestañas ${Math.round(barra.height)})`);
    ok(await p.locator('.pestana[aria-current="page"]').innerText() === 'OSPEVIC', 'la pestaña marcada es OSPEVIC');
    ok(!(await marco(p, 'ospevic').locator('.wcw-btn').isVisible()) && !(await marco(p, 'ospevic').locator('.wcw-x').isVisible()), 'sin botón redondo ni cruz');
    ok((await marco(p, 'ospevic').locator('.wcw-m.visitor').first().innerText()).includes('urgencia'), 'la pregunta se mandó sola');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'IFRAME'), 'el foco quedó en el chat (para quien usa lector de pantalla o teclado)');
    await foto(p, '05-chat-ospevic');

    // Atrás → inicio con vista previa
    await p.goBack();
    await p.waitForSelector('#portada', { state: 'visible' });
    await p.waitForTimeout(600);
    const filaO = p.locator('#conversaciones .fila', { hasText: 'OSPEVIC' });
    ok((await p.locator('#conv-rotulo').innerText()).toUpperCase() === 'TUS CONVERSACIONES', '«atrás» vuelve al inicio y el rótulo pasa a «Tus conversaciones»');
    const previa = await filaO.locator('.fila-previa').innerText();
    ok(previa === 'Te contestaron', 'la fila de la obra social dice que contestaron SIN mostrar el texto: «' + previa + '»');
    ok(await p.evaluate(() => !!document.activeElement && /OSPEVIC/.test(document.activeElement.textContent || '')), 'al volver, el foco queda en la fila de donde se salió');
    ok(/\d\d:\d\d/.test(await filaO.locator('.fila-meta').innerText()), 'y la hora');
    ok(await filaO.locator('.punto').count() === 0, 'sin punto de novedad: ya lo vio');
    await foto(p, '06-inicio-con-conversacion');

    // Escribir una consulta y elegir a quién; pasar a otra entidad antes de que contesten
    await p.locator('#consulta-campo').tap();
    await p.locator('#consulta-campo').fill('¿Dónde queda la sede?');
    await p.waitForTimeout(150);
    await p.locator('#res-enviar-lista .fila', { hasText: 'SUVICO' }).tap();
    await p.waitForURL(/\?e=suvico/);
    await marco(p, 'suvico').locator('.wcw-m.visitor').first().waitFor({ timeout: 20000 });
    await p.locator('.pestana', { hasText: 'Mavic' }).tap();
    ok(/\?e=mavic/.test(p.url()), 'pasar de SUVICO a Mavic es un toque');
    await marco(p, 'mavic').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
    await p.locator('#novedad').waitFor({ state: 'visible', timeout: 90000 });
    ok((await p.locator('#novedad').innerText()).includes('SUVICO'), 'estando en Mavic avisa: «' + (await p.locator('#novedad').innerText()) + '»');
    ok(await p.locator('.pestana', { hasText: 'SUVICO' }).locator('.punto').count() === 1, 'y la pestaña de SUVICO lleva el punto');
    ok(/^\(1\)/.test(await p.title()), 'el título de la pestaña del navegador dice (1)');
    await foto(p, '07-te-contestaron');
    await p.locator('#novedad').tap();
    await p.waitForURL(/\?e=suvico/);
    await p.waitForTimeout(500);
    ok(await p.locator('.pestana .punto').count() === 0, 'al entrar, el punto se va');
    ok((await marco(p, 'suvico').locator('.wcw-body').innerText()).includes('sede') && !(await marco(p, 'suvico').locator('.wcw-body').innerText()).includes('urgencia'), 'en SUVICO está lo de SUVICO y no lo de OSPEVIC');
    await p.locator('.pestana', { hasText: 'Inicio' }).tap();
    await p.waitForSelector('#resultados', { state: 'visible' });
    ok(await p.locator('#consulta-campo').inputValue() === '¿Dónde queda la sede?', 'al volver, la consulta sigue escrita');
    ok((await p.locator('#res-enviar-rotulo').innerText()).toUpperCase().includes('ERA PARA OTRO'), 'y ofrece mandársela a otro sin escribirla de nuevo');
    ok((await p.locator('#conversaciones .fila', { hasText: 'SUVICO' }).locator('.fila-previa').textContent()).length > 25, 'la fila de SUVICO (no reservada) sí muestra lo último que se dijo');
    await foto(p, '08-era-para-otro');
    await p.locator('#consulta-borrar').tap();
  } else {
    await p.locator('#consulta-borrar').tap();
  }

  // Sin conexión
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)), 'el service worker controla la página');
  await p.waitForTimeout(1500);
  await c.setOffline(true);
  await p.reload().catch((e) => fallas.push('sin conexión no recarga: ' + e.message));
  await p.waitForSelector('#conversaciones .fila', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('#sin-red').isVisible(), 'sin conexión la app abre igual y avisa');
  const sinRed = await p.locator('#conversaciones .fila-previa').allInnerTexts();
  ok(sinRed.every((t) => t === 'Sin conexión'), 'las filas dicen «Sin conexión» en vez de parecer activas');
  ok(await p.locator('#conversaciones .fila[aria-disabled="true"]').count() === 3, 'y no se pueden tocar');
  await foto(p, '09-sin-conexion');
  await c.setOffline(false);
  reg.config = 0;
  await p.reload();
  await p.waitForSelector('#conversaciones .fila');
  if (!RAPIDO) {
    await p.locator('iframe.marco').nth(1).waitFor({ state: 'attached', timeout: 15000 });
    await p.waitForFunction(() => { const t = [...document.querySelectorAll('#conversaciones .fila-previa')].map((n) => n.textContent); return t[0].length > 25 && t[2] === 'Te contestaron'; }, null, { timeout: 30000 }).catch(() => {});
    const previas = await p.locator('#conversaciones .fila-previa').allInnerTexts();
    ok(previas[0].length > 25 && previas[2] === 'Te contestaron', 'al reabrir, los chats con conversación cargan de fondo y muestran lo último: ' + JSON.stringify(previas.map((t) => t.slice(0, 30))));
    ok(await p.locator('iframe.marco').count() === 2 + (await p.evaluate(() => !!localStorage.getItem('webchat_token_wk_af3f6d9ebe7f380d36519ded')) ? 1 : 0), 'sólo se abren de fondo los que tienen conversación');
    ok(await p.locator('#conversaciones .punto').count() === 0, 'sin puntos de novedad falsos al recargar');
    ok(await p.locator('#novedad').isHidden(), 'ni aviso de «te contestaron» por mensajes ya vistos');
    ok(reg.config <= 3, `al reabrir, los chats no vuelven a pedir la configuración (pedidos: ${reg.config})`);
    await foto(p, '10-reabrir');

    // Borrar las conversaciones del teléfono
    await p.locator('#inicio').evaluate((n) => { n.scrollTop = n.scrollHeight; });
    await p.locator('#olvidar-abrir').tap();
    await foto(p, '11-borrar-confirmar');
    await p.locator('#olvidar-ok').tap();
    await p.waitForTimeout(300);
    ok(await p.locator('iframe.marco').count() === 0 && await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('webchat_token_')).length === 0), 'borrar las conversaciones saca los chats y sus credenciales del teléfono');
    ok((await p.locator('#conv-rotulo').innerText()).toUpperCase() === 'CON QUIÉN HABLAR', 'y el inicio vuelve a estar como la primera vez');
  }
  const propios = reg.errores.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
  ok(propios.length === 0, 'sin errores de consola' + (propios.length ? ': ' + propios.slice(0, 3).join(' | ') : ''));
  const malos = reg.malos.filter((m) => !/favicon/.test(m));
  ok(malos.length === 0, 'ningún pedido rechazado' + (malos.length ? ': ' + [...new Set(malos)].slice(0, 4).join(' | ') : ''));
  await c.close();

  // Oscuro
  ({ c, p } = await contexto(b, { ...movil, colorScheme: 'dark' }));
  await p.goto(URL0); await p.waitForSelector('#conversaciones .fila'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
  await foto(p, '12-inicio-oscuro');
  await c.close();

  // ════════ ESCRITORIO ════════
  console.log('ESCRITORIO 1366×768');
  ({ c, p, reg } = await contexto(b, { viewport: { width: 1366, height: 768 } }));
  await p.goto(URL0); await p.waitForSelector('#conversaciones .fila'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(600);
  if (V >= 3) {
    // Desde la v3: una cosa por vez también acá, y las pestañas son el menú.
    ok(await p.locator('#pestanas').isVisible() && await p.locator('.pestana').count() === 4, 'en pantalla grande las pestañas son el menú');
    ok(await p.locator('#inicio').isVisible() && await p.locator('iframe.marco').count() === 0, 'y el inicio ocupa la pantalla, sin ningún chat abierto');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin desplazamiento horizontal');
    await foto(p, '13-escritorio-inicio');
    // Escribir en el inicio mientras un chat carga de fondo: no se roba el foco
    await p.locator('#consulta-campo').click();
    await p.keyboard.type('sub');
    await p.evaluate(() => { const f = document.createElement('iframe'); f.className = 'marco'; f.setAttribute('inert', ''); f.src = 'charla.html?e=suvico'; document.getElementById('marcos').appendChild(f); });
    await p.frameLocator('iframe.marco[src="charla.html?e=suvico"]').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
    await p.waitForTimeout(600);
    await p.keyboard.type('sidio');
    ok(await p.locator('#consulta-campo').inputValue() === 'subsidio', 'un chat que carga de fondo no le saca el foco a lo que se está escribiendo');
    await foto(p, '14-escritorio-buscar');
    await p.locator('#consulta-borrar').click();
    await p.locator('#conversaciones .fila', { hasText: 'Mavic' }).click();
    await marco(p, 'mavic').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
    await p.waitForTimeout(1500);
    ok(await p.locator('#inicio').isHidden() && await p.locator('iframe.marco.activo').isVisible(), 'al elegir una conversación se ve el chat y el inicio se va');
    ok(await p.locator('.pestana[aria-current="page"]').innerText() === 'Mavic', 'la pestaña marcada es Mavic');
    const foco3 = await p.evaluate(() => { const a = document.activeElement; return a && a.tagName === 'IFRAME' ? a.contentDocument.activeElement.tagName + ':' + (a.contentDocument.activeElement.placeholder || '') : (a && a.tagName); });
    ok(/INPUT/.test(foco3), 'el foco queda en el campo del chat, listo para escribir (' + foco3 + ')');
    await foto(p, '15-escritorio-chat');
    await p.goBack();
    await p.waitForTimeout(700);
    ok(!p.url().includes(String.fromCharCode(63) + 'e=') && await p.locator('#inicio').isVisible(), 'en escritorio, «atrás» vuelve al inicio');
    ok(reg.errores.length === 0, 'sin errores de consola' + (reg.errores.length ? ': ' + reg.errores.slice(0, 3).join(' | ') : ''));
    await c.close();
    await b.close();
    console.log(fallas.length ? `\n${fallas.length} FALLA(S):\n - ` + fallas.join('\n - ') : '\nTodo en verde.');
    process.exit(fallas.length ? 1 : 0);
  }
  ok(await p.locator('#pestanas').isHidden(), 'en pantalla ancha no hay pestañas: el inicio queda de columna');
  ok(await p.locator('#vacio').isVisible(), 'y a la derecha, sin nada elegido, una invitación');
  await foto(p, '13-escritorio-inicio');
  await p.locator('#conversaciones .fila', { hasText: 'Mavic' }).click();
  await marco(p, 'mavic').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  ok(await p.locator('#inicio').isVisible() && await p.locator('iframe.marco.activo').isVisible(), 'al elegir una conversación se ven las dos cosas: la lista y el chat');
  const foco = await p.evaluate(() => { const a = document.activeElement; return a && a.tagName === 'IFRAME' ? a.contentDocument.activeElement.tagName + ':' + (a.contentDocument.activeElement.placeholder || '') : (a && a.tagName); });
  ok(/INPUT/.test(foco), 'el foco queda en el campo del chat, listo para escribir (' + foco + ')');
  // Escribir en el inicio mientras otro chat carga de fondo: no se roba el foco
  await p.locator('#consulta-campo').click();
  await p.keyboard.type('sub');
  await p.locator('#conversaciones .fila', { hasText: 'OSPEVIC' }).evaluate(() => {});   // nada: sólo asegura que existe
  await p.evaluate(() => { const f = document.createElement('iframe'); f.className = 'marco'; f.setAttribute('inert', ''); f.src = 'charla.html?e=suvico'; document.getElementById('marcos').appendChild(f); });
  await p.frameLocator('iframe.marco[src="charla.html?e=suvico"]').locator('.wcw-panel.wcw-on').waitFor({ timeout: 20000 });
  await p.waitForTimeout(600);
  await p.keyboard.type('sidio');
  ok(await p.locator('#consulta-campo').inputValue() === 'subsidio', 'un chat que carga de fondo no le saca el foco a lo que se está escribiendo');
  await foto(p, '14-escritorio-buscar');
  await p.goBack();
  await p.waitForTimeout(300);
  ok(!p.url().includes(String.fromCharCode(63)+"e=") && await p.locator('#vacio').isVisible(), 'en escritorio, «atrás» vuelve a no tener ninguna conversación elegida');
  ok(reg.errores.length === 0, 'sin errores de consola' + (reg.errores.length ? ': ' + reg.errores.slice(0, 3).join(' | ') : ''));
  await c.close();

  await b.close();
  console.log(fallas.length ? `\n${fallas.length} FALLA(S):\n - ` + fallas.join('\n - ') : '\nTodo en verde.');
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error('SE CORTÓ:', e.message.slice(0, 700)); process.exit(2); });
