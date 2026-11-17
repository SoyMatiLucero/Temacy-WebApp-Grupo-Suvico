/*
 * Servidor para PROBAR la web app en esta máquina. No se publica.
 *
 * Hace lo mismo que nginx va a hacer en el subdominio: sirve esta carpeta en la raíz y le pasa a la
 * API de la plataforma las rutas del chat, conservando el `Host` del pedido (así la API ve que la
 * página y ella están en el mismo dominio, igual que en producción).
 *
 *   node web_grupo/servidor-local.js            → http://127.0.0.1:4510, API en http://127.0.0.1:3100
 *   PUERTO=4520 API=http://127.0.0.1:3110 node web_grupo/servidor-local.js
 */
'use strict';
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PUERTO = Number(process.env.PUERTO || 4510);
const API = new URL(process.env.API || 'http://127.0.0.1:3100');
const RAIZ = __dirname;
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
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};
const NO_SE_SIRVE = new Set(['/servidor-local.js', '/LEEME.md']);

const vaALaApi = (ruta) => A_LA_API.some((re) => re.test(ruta));

function aLaApi(req, res) {
  const salida = http.request({
    host: API.hostname, port: API.port, method: req.method, path: req.url, headers: req.headers,
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  salida.on('error', () => { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('La API no responde en ' + API.origin); });
  req.pipe(salida);
}

function archivo(req, res) {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const real = path.join(RAIZ, ruta);
  if (!real.startsWith(RAIZ) || NO_SE_SIRVE.has(ruta)) { res.writeHead(404); return res.end(); }
  fs.readFile(real, (err, datos) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No existe'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(real)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
}

const servidor = http.createServer((req, res) => {
  const ruta = new URL(req.url, 'http://x').pathname;
  if (vaALaApi(ruta)) return aLaApi(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  archivo(req, res);
});

// El chat recibe los mensajes por WebSocket (/socket.io/): se pasa la conexión tal cual.
servidor.on('upgrade', (req, socket, cabeza) => {
  if (!vaALaApi(new URL(req.url, 'http://x').pathname)) return socket.destroy();
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

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Web app del grupo en http://127.0.0.1:${PUERTO}  (API: ${API.origin})`);
});
