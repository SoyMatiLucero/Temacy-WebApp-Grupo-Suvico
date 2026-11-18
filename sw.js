/*
 * Service worker de la web app del grupo (v5).
 *
 * Para qué está: que la app abra AL TOQUE, también con mala señal o sin conexión. No guarda nada de
 * las conversaciones: los mensajes, el chat (/widget.js) y la API van siempre a la red.
 *
 * Cómo: los archivos de la app se sirven de la copia guardada, sin esperar a la red. La copia se
 * renueva sólo cuando hay una publicación nueva. Este archivo lleva adentro el sello de la
 * publicación, así que cambia en cada una; el navegador lo revisa solo cada vez que se abre la app
 * y, si cambió, instala el nuevo, que:
 *   1. baja TODOS los archivos a una copia nueva, con el nombre de su sello. Mientras tanto la
 *      versión anterior sigue sirviendo la suya, entera;
 *   2. sólo si llegaron todos, y las páginas son las de esta publicación, pasa a servir la nueva
 *      y borra la anterior. Si no, no se instala: queda la anterior y se vuelve a intentar la
 *      próxima vez que se abra la app. Así nunca hay una mezcla de versiones a medio bajar;
 *   3. pasados diez minutos, la próxima vez que se abra la app, vuelve a bajar una vez el código y
 *      las páginas derecho de la red. Es por si la primera bajada agarró al servidor a mitad de
 *      una publicación (el hosting copia los archivos de a uno). Después no pide nada más.
 * Si a la copia le falta un archivo (el teléfono la borró para hacer lugar), se arma de nuevo.
 *
 * En una máquina de desarrollo no hay sello: ahí la copia se renueva entera al abrir la app y, como
 * mucho, cada diez minutos.
 *
 * Consecuencia: un cambio publicado se ve la SEGUNDA vez que se abre la app, no la primera.
 * Y otra, a cuidar al publicar: si falta UNO solo de los archivos de la lista, la versión nueva no
 * se instala y los teléfonos se quedan con la anterior sin avisar. El guion de publicación
 * comprueba que estén todos.
 *
 * Al sumar un archivo a la app hay que sumarlo a ARCHIVOS, o no va a estar sin conexión.
 * Los de icons/ y fuentes/ se dan por fijos (ver FIJO): si cambia el contenido de uno, hay que
 * cambiarle el nombre.
 */
// El sello de esta publicación. El deploy lo reemplaza por el identificador del commit (ver
// .github/workflows/deploy-ftp.yml); en una máquina de desarrollo queda tal cual. Sirve para dos
// cosas: este archivo cambia en cada publicación, así que el teléfono se entera de que hay una
// nueva; y los archivos se piden con el sello en la dirección, así ningún intermediario (la CDN
// del hosting guardaba los .js y .css una semana) puede devolver los de la publicación anterior.
const SELLO = '__SELLO__';
const SELLADA = /^[0-9a-f]{6,40}$/.test(SELLO);       // publicada; si no, es una máquina de desarrollo
const COPIA = 'grupo-v5-' + SELLO;
const BASE = new URL(self.registration.scope).pathname;
const ARCHIVOS = ['', 'index.html', 'app.css', 'app.js', 'movimiento.js', 'comun.js', 'entidades.js',
  'charla.html', 'charla.css', 'charla.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'fuentes/cabinet-grotesk-800.woff2', 'fuentes/satoshi-400.woff2', 'fuentes/satoshi-500.woff2', 'fuentes/satoshi-700.woff2'];
const RUTAS = new Set(ARCHIVOS.map((a) => BASE + a));
// Íconos y tipografías: no cambian de contenido sin cambiar de nombre. Se piden por la misma
// dirección que usa la página, así el navegador entrega los que ya bajó en vez de bajarlos otra vez.
const FIJO = /^(icons|fuentes)\//;
// Las páginas llevan adentro el sello de su publicación: se puede comprobar de cuál son.
const PAGINA = /^$|\.html$/;
// La nota de la copia: cuándo se armó y si ya tuvo la segunda bajada. Se guarda en la copia misma,
// porque el navegador apaga y prende este guion a cada rato y lo que hay en memoria se pierde.
const NOTA = BASE + '__nota';
const CADA_MS = 10 * 60 * 1000;
const ESPERA_MS = 10 * 60 * 1000;
let ultimaVez = 0;
let alDia = false;
let enCurso = null;

function pedir(archivo, deLaRed) {
  const ruta = BASE + archivo;
  if (!SELLADA) return fetch(ruta + '?v=' + SELLO, { cache: 'no-cache' });
  if (FIJO.test(archivo)) return fetch(ruta);
  // Las páginas siempre, y todo lo demás en una actualización o en la segunda bajada, derecho del
  // servidor: sin la caché del navegador y con una dirección que ningún intermediario pudo guardar.
  if (deLaRed || PAGINA.test(archivo)) return fetch(ruta + '?v=' + SELLO + '&r=' + Date.now(), { cache: 'no-store' });
  // Queda el código en la primera instalación: la página lo acaba de bajar con esta misma
  // dirección, y se toma de ahí en vez de bajarlo otra vez.
  return fetch(ruta + '?v=' + SELLO, { cache: 'force-cache' });
}

function esDeEstaPublicacion(archivo, respuesta) {
  if (!SELLADA || !PAGINA.test(archivo)) return Promise.resolve(true);
  return respuesta.clone().text().then((texto) => texto.indexOf('?v=' + SELLO) >= 0);
}

// Trae todos los archivos y, sólo si llegaron todos y son de esta publicación, los guarda.
// Devuelve una promesa con true si la copia quedó al día.
function ponerAlDia(deLaRed) {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const respuestas = await Promise.all(ARCHIVOS.map((a) => pedir(a, deLaRed)));
    if (respuestas.some((r) => !r.ok)) return false;          // faltó alguno: se deja la copia como estaba
    const propias = await Promise.all(ARCHIVOS.map((a, i) => esDeEstaPublicacion(a, respuestas[i])));
    if (propias.some((si) => !si)) return false;              // el servidor está a mitad de una publicación
    const copia = await caches.open(COPIA);
    // Se guardan por su ruta pelada, que es como después se los busca.
    await Promise.all(ARCHIVOS.map((a, i) => copia.put(BASE + a, respuestas[i])));
    return true;
  })().catch(() => false).then((llego) => { enCurso = null; return llego; });
  return enCurso;
}

function leerNota() {
  return caches.open(COPIA).then((copia) => copia.match(NOTA)).then((r) => (r ? r.json() : null)).catch(() => null);
}
function anotar(nota) {
  return caches.open(COPIA).then((copia) => copia.put(NOTA, new Response(JSON.stringify(nota), { headers: { 'Content-Type': 'application/json' } })));
}

// Lo que hay que hacer por detrás cuando se abre la app. «falta»: se pidió un archivo de la app
// y no estaba en la copia.
function revisar(falta) {
  if (falta) alDia = false;
  if (alDia || Date.now() - ultimaVez < CADA_MS) return Promise.resolve();
  ultimaVez = Date.now();
  if (!SELLADA) return ponerAlDia(false);
  return (falta ? Promise.resolve(null) : leerNota()).then((nota) => {
    if (nota && nota.revisada) { alDia = true; return; }
    const edad = nota ? Date.now() - nota.en : -1;
    if (edad >= 0 && edad < ESPERA_MS) return;                // recién instalada: todavía no
    return ponerAlDia(true).then((llego) => {
      if (!llego) return;
      alDia = true;
      return anotar({ en: Date.now(), revisada: true });
    });
  }).catch(() => {});
}

self.addEventListener('install', (e) => {
  ultimaVez = Date.now();
  // Si ya había una versión andando, todo se baja derecho del servidor: a esta página la sirvió
  // la copia anterior, y lo que el navegador tenga guardado con el sello nuevo sólo puede venir de
  // un intento anterior de instalar, quizás con el servidor a medio copiar.
  const actualizacion = !!self.registration.active;
  e.waitUntil(ponerAlDia(actualizacion).then((llego) => {
    if (llego) return anotar({ en: Date.now(), revisada: false });
    // Publicada, sin la copia entera no se instala: sigue la versión anterior con la suya.
    if (SELLADA) return caches.delete(COPIA).then(() => { throw new Error('la copia no llegó entera'); });
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('grupo-') && k !== COPIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sólo los archivos de la app, que son siempre los mismos y vienen de este sitio. Todo lo demás
  // (/api, /widget.js, /socket.io, logos, adjuntos) no se toca ni se guarda: en la copia no entra
  // nada que haya subido o escrito alguien.
  if (!RUTAS.has(url.pathname)) return;
  // La página es la misma con cualquier parámetro (./?e=suvico, charla.html?e=…): se busca por su ruta.
  const guardado = caches.open(COPIA).then((copia) => copia.match(url.pathname));
  e.respondWith(guardado.then((r) => r || fetch(req), () => fetch(req)));
  e.waitUntil(guardado.then((r) => revisar(!r), () => revisar(true)));
});
