/*
 * Service worker de la web app del grupo.
 *
 * Hace una sola cosa: que la app ABRA sin conexión (la pantalla de entidades y el aviso de «sin
 * conexión»). No guarda nada del chat: las conversaciones, el widget y la API van siempre a la red.
 *
 * La estrategia es «primero la red, y la copia guardada sólo si la red no responde». Los archivos
 * son chicos y así nunca queda una versión vieja pegada en el teléfono de nadie: publicar una
 * versión nueva no necesita que nadie borre nada.
 */
const VERSION = 'grupo-v1';
const BASE = new URL(self.registration.scope).pathname;
const ARCHIVOS = ['', 'index.html', 'app.css', 'app.js', 'entidades.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const RUTAS = new Set(ARCHIVOS.map((a) => BASE + a));
const ESPERA_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([...RUTAS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Sólo los archivos de la app. Todo lo demás (/api, /widget.js, /socket.io, /uploads…) no se toca.
  if (!RUTAS.has(url.pathname)) return;

  // La página es la misma para ./ y ./?e=<entidad>: se guarda y se busca sin el parámetro.
  const clave = url.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), ESPERA_MS);
      const res = await fetch(req, { signal: control.signal, cache: 'no-cache' });
      clearTimeout(reloj);
      if (res.ok) cache.put(clave, res.clone());
      return res;
    } catch (err) {
      const guardado = await cache.match(clave);
      if (guardado) return guardado;
      throw err;
    }
  })());
});
