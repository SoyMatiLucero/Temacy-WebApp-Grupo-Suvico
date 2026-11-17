/*
 * Web app del grupo — la puerta de entrada a los chats de las entidades.
 *
 * Dos vistas en la misma página:
 *   ./            → «¿Con quién querés hablar?»
 *   ./?e=<slug>   → el chat de esa entidad
 *
 * El chat es el widget de la plataforma (/widget.js), sin tocar, con la clave de la entidad. Cambiar
 * de entidad es cambiar de página a propósito: el widget no tiene forma de desmontarse, así que dos
 * claves en la misma página dejarían dos chats superpuestos.
 *
 * El widget no expone API: se maneja por su DOM, igual que las páginas de cada entidad
 * (.wcw-btn abre, .wcw-panel.wcw-on = abierto, .wcw-expand amplía en pantallas grandes).
 */
(function () {
  'use strict';

  var G = window.GRUPO || { nombre: '', entidades: [] };
  var $ = function (id) { return document.getElementById(id); };

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ── Lo que viene de la configuración del chat se valida antes de usarlo ── */
  function texto(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
  function color(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : ''; }
  function logo(v) {
    if (typeof v !== 'string') return '';
    var s = v.trim();
    return /^(https:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp|svg\+xml);)/i.test(s) && s.length < 300000 ? s : '';
  }
  // Blanco o tinta oscura, según cuál se lea sobre el color de la entidad.
  function tintaSobre(hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (x) {
      x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    var l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    // 0.21 es donde el contraste con blanco y con la tinta oscura se cruzan: de ahí para arriba gana la tinta.
    return l > 0.21 ? '#16202b' : '#ffffff';
  }

  function configGuardada(ent) {
    try { return JSON.parse(leer('grupo_cfg_' + ent.slug) || 'null'); } catch (e) { return null; }
  }

  /*
   * Pide la configuración del chat de una entidad. Tres resultados:
   *   ok      → el chat está habilitado; trae el nombre del bot, el color y el logo
   *   no      → la entidad no tiene el chat habilitado para este sitio (la API contesta 4xx)
   *   sinred  → no hubo respuesta (sin conexión o el servidor caído)
   * La última configuración buena se guarda, para pintar la marca al instante la próxima vez.
   */
  function pedirConfig(ent) {
    return fetch('/api/web-chat/config?key=' + encodeURIComponent(ent.clave), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 400 || r.status === 403 || r.status === 404) return { estado: 'no' };
        if (!r.ok) return { estado: 'sinred' };
        return r.json().then(function (c) {
          var b = (c && c.branding) || {};
          var cfg = { bot: texto(c && c.nombre, 40), color: color(b.color), logo: logo(b.logo) };
          guardar('grupo_cfg_' + ent.slug, JSON.stringify(cfg));
          return { estado: 'ok', cfg: cfg };
        });
      })
      .catch(function () { return { estado: 'sinred' }; });
  }

  // Pone el color de la entidad en `caja` y su logo (o su inicial) en `avatar`.
  function pintarMarca(ent, cfg, caja, avatar) {
    var c = (cfg && cfg.color) || ent.color;
    caja.style.setProperty('--marca', c);
    caja.style.setProperty('--marca-tinta', tintaSobre(c));
    avatar.textContent = '';
    if (cfg && cfg.logo) {
      var img = document.createElement('img');
      img.alt = '';
      img.onerror = function () { avatar.textContent = ent.nombre.charAt(0); };
      img.src = cfg.logo;
      avatar.appendChild(img);
    } else {
      avatar.textContent = ent.nombre.charAt(0);
    }
    return c;
  }

  function hayConversacion(ent) { return !!leer('webchat_token_' + ent.clave); }

  /* ── Inicio ─────────────────────────────────────────────────────────────── */
  function vistaInicio() {
    document.title = G.nombre;
    document.querySelectorAll('[data-app-nombre]').forEach(function (n) { n.textContent = G.nombre; });
    var ul = $('entidades');

    var tarjetas = G.entidades.map(function (ent) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'entidad';
      a.href = '?e=' + ent.slug;

      var avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');

      var cuerpo = document.createElement('div');
      cuerpo.className = 'entidad-texto';
      var que = document.createElement('p'); que.className = 'que'; que.textContent = ent.que;
      var nombre = document.createElement('p'); nombre.className = 'entidad-nombre'; nombre.textContent = ent.nombre;
      var temas = document.createElement('p'); temas.className = 'entidad-temas'; temas.textContent = ent.temas;
      var estado = document.createElement('p'); estado.className = 'entidad-estado'; estado.hidden = true;
      cuerpo.appendChild(que); cuerpo.appendChild(nombre); cuerpo.appendChild(temas); cuerpo.appendChild(estado);

      var flecha = document.createElement('span');
      flecha.className = 'flecha';
      flecha.setAttribute('aria-hidden', 'true');
      flecha.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      a.appendChild(avatar); a.appendChild(cuerpo); a.appendChild(flecha);
      li.appendChild(a); ul.appendChild(li);

      var t = { ent: ent, a: a, avatar: avatar, estado: estado, flecha: flecha, cfg: configGuardada(ent), disponible: true };
      pintarMarca(ent, t.cfg, a, avatar);
      pintarEstado(t);
      return t;
    });

    function pintarEstado(t) {
      var msj = '';
      if (!t.disponible) msj = 'No disponible por ahora';
      else if (hayConversacion(t.ent)) msj = 'Seguir la conversación';
      else if (t.cfg && t.cfg.bot) msj = 'Te atiende ' + t.cfg.bot;
      t.estado.textContent = msj;
      t.estado.hidden = !msj;
      t.estado.classList.toggle('no', !t.disponible);
    }

    tarjetas.forEach(function (t) {
      pedirConfig(t.ent).then(function (r) {
        if (r.estado === 'ok') { t.cfg = r.cfg; pintarMarca(t.ent, t.cfg, t.a, t.avatar); }
        if (r.estado === 'no') {
          t.disponible = false;
          t.a.removeAttribute('href');
          t.a.setAttribute('aria-disabled', 'true');
          t.flecha.hidden = true;
        }
        pintarEstado(t);
      });
    });

    // Al volver con «atrás», la página sale de la memoria del navegador tal como quedó: se repasa
    // qué entidades ya tienen una conversación empezada.
    window.addEventListener('pageshow', function (e) { if (e.persisted) tarjetas.forEach(pintarEstado); });

    $('inicio').hidden = false;
    prepararInstalacion();
  }

  /* ── Charla ─────────────────────────────────────────────────────────────── */
  function vistaCharla(ent) {
    var caja = $('charla'), avatar = $('charla-avatar');
    var estado = $('charla-estado'), abrir = $('abrir-chat'), reintentar = $('reintentar');
    var cfg = configGuardada(ent);

    function titular() {
      $('charla-titulo').textContent = cfg && cfg.bot ? 'Hablás con ' + cfg.bot + ', de ' + ent.nombre : ent.nombre;
      document.title = ent.nombre + ' · ' + G.nombre;
      var c = pintarMarca(ent, cfg, caja, avatar);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', c);
    }
    function fallo(msj, conReintento) {
      estado.textContent = msj;
      abrir.hidden = true;
      reintentar.hidden = !conReintento;
    }

    $('charla-que').textContent = ent.que;
    titular();
    estado.textContent = 'Abriendo el chat…';
    reintentar.onclick = function () { location.reload(); };
    abrir.onclick = function () { abrirPanel(); };
    caja.hidden = false;

    pedirConfig(ent).then(function (r) {
      if (r.estado === 'no') {
        return fallo('El chat de ' + ent.nombre + ' no está disponible en este momento. Probá más tarde o elegí otra entidad.', false);
      }
      if (r.estado === 'sinred') {
        return fallo('No pudimos conectar. Revisá tu conexión y volvé a intentar.', true);
      }
      cfg = r.cfg;
      titular();

      var s = document.createElement('script');
      s.src = '/widget.js';
      s.async = true;
      s.setAttribute('data-key', ent.clave);
      s.onerror = function () { fallo('No pudimos cargar el chat. Revisá tu conexión y volvé a intentar.', true); };
      document.body.appendChild(s);

      // El widget arma su botón cuando termina de cargar: se lo espera y se abre el chat solo.
      var intentos = 0;
      var espera = setInterval(function () {
        intentos++;
        if (abrirPanel()) {
          clearInterval(espera);
          estado.textContent = 'Si cerrás el chat, la conversación queda guardada en este dispositivo y la podés retomar.';
          abrir.hidden = false;
        } else if (intentos > 66) { // ~10 segundos
          clearInterval(espera);
          fallo('No pudimos abrir el chat. Volvé a intentar.', true);
        }
      }, 150);
    });
  }

  var yaAmpliado = false;
  function abrirPanel() {
    var boton = document.querySelector('.wcw-btn');
    if (!boton) return false;
    var panel = document.querySelector('.wcw-panel');
    if (!panel || !panel.classList.contains('wcw-on')) boton.click();
    if (!yaAmpliado) setTimeout(ampliarEnPantallaGrande, 350);
    return true;
  }
  // En el teléfono el chat ya ocupa toda la pantalla. En una pantalla grande abre como una ventana
  // chica en la esquina: acá es lo principal de la página, así que se amplía una vez (después la
  // persona lo puede contraer desde el menú del chat y se respeta).
  function ampliarEnPantallaGrande() {
    if (window.innerWidth <= 480) return;
    var panel = document.querySelector('.wcw-panel'), ampliar = document.querySelector('.wcw-expand');
    if (!panel || !ampliar) return;
    yaAmpliado = true;
    if (panel.classList.contains('wcw-expanded') || panel.classList.contains('tam-pantalla')) return;
    ampliar.click();
  }

  /* ── Instalación y conexión ─────────────────────────────────────────────── */
  function prepararInstalacion() {
    var boton = $('instalar'), pedido = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      pedido = e;
      boton.hidden = false;
    });
    boton.onclick = function () {
      if (!pedido) return;
      pedido.prompt();
      pedido.userChoice.then(function () { pedido = null; boton.hidden = true; });
    };
    window.addEventListener('appinstalled', function () { boton.hidden = true; });
  }

  function vigilarConexion() {
    var aviso = $('sin-red');
    function pintar() { aviso.hidden = navigator.onLine !== false; }
    window.addEventListener('online', pintar);
    window.addEventListener('offline', pintar);
    pintar();
  }

  /* ── Arranque ───────────────────────────────────────────────────────────── */
  var slug = (new URLSearchParams(location.search).get('e') || '').toLowerCase();
  var entidad = null;
  G.entidades.forEach(function (e) { if (e.slug === slug) entidad = e; });

  vigilarConexion();
  if (slug && !entidad) { location.replace('./'); return; }
  if (entidad) vistaCharla(entidad); else vistaInicio();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
}());
