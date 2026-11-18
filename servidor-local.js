/*
 * Servidor para PROBAR la web app del grupo en esta máquina. No es parte de la app.
 *
 * La app es la v5 (carpeta v5/). Las versiones anteriores están en referencia/ (v1 a v4). Cada una
 * se levanta en su propio puerto —con su almacenamiento y su service worker, como si fueran sitios
 * distintos— y hay una página para verlas lado a lado:
 *
 *   node servidor-local.js                  → la app (v5) en :4550
 *   node servidor-local.js referencia       → además v1 en :4510 … v4 en :4540 · lado a lado en :4505
 *   node servidor-local.js v3 v5            → sólo esas versiones
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
const LA_APP = 'v5';              // la versión elegida (18-11-2026): está en la raíz; las demás, en referencia/
const PUERTO_COMPARADOR = 4505;
const puertoDe = (version) => 4500 + 10 * Number(version.slice(1));   // v1 → 4510, v2 → 4520…
const carpetaDe = (version) => path.join(version === LA_APP ? BASE : REFERENCIA, version);

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
const deReferencia = fs.existsSync(REFERENCIA) ? fs.readdirSync(REFERENCIA).filter((d) => /^v\d+$/.test(d) && d !== LA_APP && hay(d)) : [];
const todas = deReferencia.concat(hay(LA_APP) ? [LA_APP] : []).sort();
// Sin argumentos, sólo la app. Con `referencia`, todas. Con nombres de versión, esas.
const pedidas = process.argv.slice(2);
const versiones = !pedidas.length ? todas.filter((v) => v === LA_APP)
  : pedidas.includes('referencia') ? todas
  : todas.filter((v) => pedidas.includes(v));
if (!versiones.length) { console.error('No hay ninguna versión para levantar. Están: ' + (todas.join(', ') || 'ninguna')); process.exit(1); }

console.log(`Web app del grupo  (API: ${API.origin})`);
versiones.forEach(levantarVersion);
if (versiones.length > 1) levantarComparador(versiones);
if (ESCUCHA === '0.0.0.0') {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('  desde la red local: cambiá 127.0.0.1 por ' + (ips.join(' o ') || 'la IP de esta máquina'));
}
