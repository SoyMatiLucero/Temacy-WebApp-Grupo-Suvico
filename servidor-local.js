/*
 * Servidor para PROBAR la web app del grupo en esta máquina. No es parte de la app.
 *
 * La app está en la raíz del repo (index.html y compañía; era la v5). Las versiones anteriores están
 * en referencia/ (v1 a v4). Cada una se levanta en su propio puerto —con su almacenamiento y su
 * service worker, como si fueran sitios distintos— y hay una página para verlas lado a lado:
 *
 *   node servidor-local.js                  → la app en :4550
 *   node servidor-local.js referencia       → además v1 en :4510 … v4 en :4540 · lado a lado en :4505
 *   node servidor-local.js v3               → la app y sólo esa de referencia · lado a lado en :4505
 *   API=http://127.0.0.1:3110 node …        → otra API (por defecto http://127.0.0.1:3100)
 *   RED=1 node …                            → escucha también en la red local, para abrirla desde un
 *                                             teléfono (ahí no hay modo sin conexión ni micrófono:
 *                                             el navegador los reserva para https)
 *
 * Cada puerto hace lo que tiene que hacer el servidor que la publique: sirve la carpeta de esa
 * versión en la raíz y le pasa a la API de la plataforma las rutas del chat, conservando el `Host`
 * del pedido (así la API ve que la página y ella están en el mismo dominio, igual que en producción).
 *
 * Lo que NO hace, a propósito: servir en este dominio nada que haya subido alguien. Los logos, los
 * archivos que manda el bot y el aviso de privacidad se piden acá pero se contestan con una
 * redirección al dominio de la plataforma. En el dominio de la app están guardadas las credenciales
 * de las tres conversaciones: un archivo subido que se abriera acá podría leerlas.
 */
'use strict';
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = new URL(process.env.API || 'http://127.0.0.1:3100');
const ESCUCHA = process.env.RED === '1' ? '0.0.0.0' : '127.0.0.1';
const BASE = __dirname;
const REFERENCIA = path.join(BASE, 'referencia');
const LA_APP = 'app';             // la versión elegida (18-11-2026, era la v5): sus archivos están en la raíz del repo
const PUERTO_APP = 4550;          // el que tenía cuando era la v5: en esta máquina conserva lo guardado
const PUERTO_COMPARADOR = 4505;
const puertoDe = (version) => (version === LA_APP ? PUERTO_APP : 4500 + 10 * Number(version.slice(1)));   // v1 → 4510, v2 → 4520…
const carpetaDe = (version) => (version === LA_APP ? BASE : path.join(REFERENCIA, version));
// La app comparte la raíz con cosas que no son de ella (los documentos, las pruebas, las versiones
// de referencia, este archivo). Por el puerto de la app no se sirven: tampoco se publican.
const FUERA_DE_LA_APP = /^(referencia|pruebas|docs|herramientas)\/|^servidor-local\.js$|(^|\/)\./i;

// SÓLO lo que el chat necesita, que es lo mismo que tiene que hacer el servidor que la publique
// (ver LEEME.md). El resto de la API de la plataforma no se expone en este dominio: si el chat
// empieza a pedir una ruta nueva, acá da 404 y se ve en la prueba, que es la idea.
const A_LA_API = [
  /^\/api\/web-chat\//,   // el chat: configuración, mensajes, adjuntos, trámites
  /^\/socket\.io\//,      // los mensajes en vivo
  /^\/widget\.js$/,       // el chat mismo
];
// Esto se pide acá pero se sirve DESDE la plataforma (redirección), nunca en este dominio.
const A_LA_PLATAFORMA = [
  /^\/uploads\//,         // imágenes y archivos que manda el bot
  /^\/brands\//,          // logos de las entidades
  /^\/privacidad\//,      // el aviso de privacidad de cada entidad
];
const LOCAL = ['127.0.0.1', 'localhost', '::1'];
// Adónde redirigir: a la API. Si la API es de esta máquina y el pedido vino por la red local (RED=1),
// se arma con el nombre por el que llegó el pedido, para que el teléfono la encuentre.
// Por un túnel (ngrok y parecidos) nada de eso sirve: quien entra de afuera no alcanza la API de esta
// máquina. Con PLATAFORMA=https://… lo que llega por el túnel se redirige a ese sitio público, que es
// donde están los logos. Los archivos que mande el bot LOCAL no existen ahí y dan 404.
const PUBLICA = /^https?:\/\/[^/]+\/?$/.test(process.env.PLATAFORMA || '') ? process.env.PLATAFORMA.replace(/\/$/, '') : '';
function plataforma(req) {
  if (PUBLICA && (req.headers['x-forwarded-host'] || req.headers['x-forwarded-for'])) return PUBLICA;
  const maquina = String(req.headers.host || '').replace(/:\d+$/, '');
  return LOCAL.includes(API.hostname) && maquina && !LOCAL.includes(maquina) ? `http://${maquina}:${API.port}` : API.origin;
}
// Sólo se sirven archivos de estos tipos: lo demás (los .md, este mismo archivo si estuviera) da 404.
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
};

const rutaDe = (url) => { try { return decodeURIComponent(new URL(url, 'http://x').pathname); } catch (e) { return null; } };
const vaALaApi = (ruta) => A_LA_API.some((re) => re.test(ruta));
const vaALaPlataforma = (ruta) => A_LA_PLATAFORMA.some((re) => re.test(ruta));

// El archivo que corresponde a una ruta, o null si no existe o cae fuera de la carpeta. Se compara
// contra la carpeta CON su separador: comparar el prefijo pelado dejaba pasar a una carpeta hermana
// que empezara igual (…/v1 y …/v10).
function archivoDe(raiz, ruta, vedado) {
  if (ruta == null || ruta.includes('\0')) return null;
  const real = path.resolve(raiz, '.' + (ruta.endsWith('/') ? ruta + 'index.html' : ruta));
  if (!real.startsWith(raiz + path.sep) || !TIPOS[path.extname(real)]) return null;
  // Se decide sobre el archivo ya resuelto, no sobre la dirección como llegó (que puede traer `..`).
  if (vedado && vedado.test(path.relative(raiz, real).split(path.sep).join('/'))) return null;
  return real;
}

function servirArchivo(real, res) {
  fs.readFile(real || '', (err, datos) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No existe'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(real)], 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
}

function aLaApi(req, res) {
  const salida = http.request({
    host: API.hostname, port: API.port, method: req.method, path: req.url, headers: req.headers,
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  salida.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('La API no responde en ' + API.origin);
  });
  req.pipe(salida);
}

// Un puerto ocupado por otro programa no puede tirar abajo a los demás: se avisa y se sigue.
function escuchar(servidor, puerto, nombre) {
  servidor.on('error', (e) => console.error(`  ${nombre}: no se pudo abrir el puerto ${puerto} (${e.code === 'EADDRINUSE' ? 'lo está usando otro programa' : e.message})`));
  servidor.listen(puerto, ESCUCHA, () => console.log(`  ${nombre}: http://127.0.0.1:${puerto}`));
}

function levantarVersion(version) {
  const raiz = carpetaDe(version);
  const servidor = http.createServer((req, res) => {
    const ruta = rutaDe(req.url);
    if (ruta && vaALaApi(ruta)) return aLaApi(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (ruta && vaALaPlataforma(ruta)) { res.writeHead(302, { Location: plataforma(req) + req.url }); return res.end(); }
    servirArchivo(archivoDe(raiz, ruta, version === LA_APP ? FUERA_DE_LA_APP : null), res);
  });
  // El chat recibe los mensajes por WebSocket (/socket.io/): se pasa la conexión tal cual.
  servidor.on('upgrade', (req, socket, cabeza) => {
    const ruta = rutaDe(req.url);
    if (!ruta || !vaALaApi(ruta)) return socket.destroy();
    const api = net.connect(Number(API.port), API.hostname, () => {
      const lineas = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lineas.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      api.write(lineas.join('\r\n') + '\r\n\r\n');
      if (cabeza && cabeza.length) api.write(cabeza);
      api.pipe(socket); socket.pipe(api);
    });
    api.on('error', () => socket.destroy());
    socket.on('error', () => api.destroy());
  });
  escuchar(servidor, puertoDe(version), version);
}

// La página que muestra las versiones lado a lado. Sabe qué versiones hay por /versiones.js.
function levantarComparador(versiones) {
  const comparador = http.createServer((req, res) => {
    const ruta = rutaDe(req.url);
    if (ruta === '/versiones.js') {
      res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-cache' });
      return res.end('window.VERSIONES = ' + JSON.stringify(versiones.map((v) => ({ nombre: v, puerto: puertoDe(v) }))) + ';');
    }
    if (ruta !== '/') { res.writeHead(404); return res.end(); }
    servirArchivo(path.join(REFERENCIA, 'comparar.html'), res);
  });
  escuchar(comparador, PUERTO_COMPARADOR, 'lado a lado');
}

const hay = (v) => fs.existsSync(path.join(carpetaDe(v), 'index.html'));
const deReferencia = fs.existsSync(REFERENCIA) ? fs.readdirSync(REFERENCIA).filter((d) => /^v\d+$/.test(d) && hay(d)).sort() : [];
if (!hay(LA_APP)) { console.error('No está la app: falta index.html en la raíz del repo.'); process.exit(1); }
// La app se levanta siempre. Con `referencia`, además todas las de referencia; con nombres (v3), esas.
const pedidas = process.argv.slice(2);
const desconocidas = pedidas.filter((p) => p !== 'referencia' && !deReferencia.includes(p));
if (desconocidas.length) {
  console.error(`No conozco «${desconocidas.join('», «')}». Se puede pedir: referencia (todas)` + (deReferencia.length ? ', ' + deReferencia.join(', ') : ''));
  process.exit(1);
}
// La app va última: el comparador arranca mostrando las dos últimas de la lista.
const versiones = (pedidas.includes('referencia') ? deReferencia : deReferencia.filter((v) => pedidas.includes(v))).concat(LA_APP);

console.log(`Web app del grupo  (API: ${API.origin})`);
versiones.forEach(levantarVersion);
if (versiones.length > 1) levantarComparador(versiones);
if (ESCUCHA === '0.0.0.0') {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('  desde la red local: cambiá 127.0.0.1 por ' + (ips.join(' o ') || 'la IP de esta máquina'));
}
