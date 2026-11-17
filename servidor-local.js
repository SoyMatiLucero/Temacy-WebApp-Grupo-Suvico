/*
 * Servidor para PROBAR la web app del grupo en esta máquina. No se publica.
 *
 * Levanta cada versión (web_grupo/v1, web_grupo/v2, …) en su propio puerto —cada una con su
 * almacenamiento y su service worker, como si fueran dos sitios distintos— y una página para verlas
 * lado a lado:
 *
 *   node web_grupo/servidor-local.js        → v1 en :4510 · v2 en :4520 · comparador en :4500
 *   node web_grupo/servidor-local.js v2     → sólo esa versión
 *   API=http://127.0.0.1:3110 node …        → otra API (por defecto http://127.0.0.1:3100)
 *   RED=1 node …                            → escucha también en la red local, para abrirla desde un
 *                                             teléfono (ahí no hay modo sin conexión ni micrófono:
 *                                             el navegador los reserva para https)
 *
 * Cada puerto hace lo mismo que nginx va a hacer en el subdominio: sirve la carpeta de esa versión en
 * la raíz y le pasa a la API de la plataforma las rutas del chat, conservando el `Host` del pedido
 * (así la API ve que la página y ella están en el mismo dominio, igual que en producción).
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
const PUERTO_COMPARADOR = 4500;
const puertoDe = (version) => 4500 + 10 * Number(version.slice(1));   // v1 → 4510, v2 → 4520…

// SÓLO lo que el chat necesita, que es lo mismo que tiene que reenviar nginx en el subdominio (ver
// LEEME.md). El resto de la API de la plataforma no se expone en este dominio: si el chat empieza a
// pedir una ruta nueva, acá da 404 y se ve en la prueba, que es la idea.
const A_LA_API = [
  /^\/api\/web-chat\//,   // el chat: configuración, mensajes, adjuntos, trámites
  /^\/socket\.io\//,      // los mensajes en vivo
  /^\/widget\.js$/,       // el chat mismo
  /^\/uploads\//,         // imágenes y archivos que manda el bot
  /^\/brands\//,          // logos de las entidades
  /^\/privacidad\//,      // el aviso de privacidad de cada entidad
];
// Sólo se sirven archivos de estos tipos: lo demás (los .md, este mismo archivo si estuviera) da 404.
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

const rutaDe = (url) => { try { return decodeURIComponent(new URL(url, 'http://x').pathname); } catch (e) { return null; } };
const vaALaApi = (ruta) => A_LA_API.some((re) => re.test(ruta));

// El archivo que corresponde a una ruta, o null si no existe o cae fuera de la carpeta. Se compara
// contra la carpeta CON su separador: comparar el prefijo pelado dejaba pasar a una carpeta hermana
// que empezara igual (…/v1 y …/v10).
function archivoDe(raiz, ruta) {
  if (ruta == null || ruta.includes('\0')) return null;
  const real = path.resolve(raiz, '.' + (ruta.endsWith('/') ? ruta + 'index.html' : ruta));
  if (!real.startsWith(raiz + path.sep) || !TIPOS[path.extname(real)]) return null;
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

function levantarVersion(version) {
  const raiz = path.join(BASE, version);
  const servidor = http.createServer((req, res) => {
    const ruta = rutaDe(req.url);
    if (ruta && vaALaApi(ruta)) return aLaApi(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    servirArchivo(archivoDe(raiz, ruta), res);
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
  servidor.listen(puertoDe(version), ESCUCHA, () => console.log(`  ${version}: http://127.0.0.1:${puertoDe(version)}`));
}

// La página que muestra las versiones lado a lado. Sabe qué versiones hay por /versiones.js.
function levantarComparador(versiones) {
  http.createServer((req, res) => {
    const ruta = rutaDe(req.url);
    if (ruta === '/versiones.js') {
      res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-cache' });
      return res.end('window.VERSIONES = ' + JSON.stringify(versiones.map((v) => ({ nombre: v, puerto: puertoDe(v) }))) + ';');
    }
    if (ruta !== '/') { res.writeHead(404); return res.end(); }
    servirArchivo(path.join(BASE, 'comparar.html'), res);
  }).listen(PUERTO_COMPARADOR, ESCUCHA, () => console.log(`  lado a lado: http://127.0.0.1:${PUERTO_COMPARADOR}`));
}

const todas = fs.readdirSync(BASE).filter((d) => /^v\d+$/.test(d) && fs.existsSync(path.join(BASE, d, 'index.html'))).sort();
const pedidas = process.argv.slice(2);
const versiones = pedidas.length ? todas.filter((v) => pedidas.includes(v)) : todas;
if (!versiones.length) { console.error('No hay ninguna versión para levantar. Están: ' + (todas.join(', ') || 'ninguna')); process.exit(1); }

console.log(`Web app del grupo  (API: ${API.origin})`);
versiones.forEach(levantarVersion);
if (versiones.length > 1) levantarComparador(versiones);
if (ESCUCHA === '0.0.0.0') {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('  desde la red local: cambiá 127.0.0.1 por ' + (ips.join(' o ') || 'la IP de esta máquina'));
}
