/*
 * Lo que comparten la app (app.js) y el marco de cada chat (charla.js): guardar cosas en el
 * teléfono, y leer y validar la configuración del chat de cada entidad.
 *
 * Todo lo que viene de esa configuración lo escribe la entidad en la plataforma, así que se trata
 * como texto ajeno: se recorta, se valida y nunca se mete como HTML.
 */
window.Comun = (function () {
  'use strict';

  var G = window.GRUPO || { nombre: '', entidades: [], situaciones: [] };

  // La versión de lo que se dicen la app y los marcos de los chats. Si cambia qué mensajes se
  // mandan o qué significan, se sube el número: al publicar, por un rato puede quedar la app
  // vieja con un marco nuevo, y así la app se da cuenta y se recarga sola (ver app.js, «hola»).
  var VERSION = 5;
  // Prefijo de todo lo que la app guarda en el navegador. Es FIJO a propósito: si dependiera de
  // VERSION, cada vez que se sube ese número la app olvidaría qué mensajes ya se vieron y avisaría
  // «te contestaron» por conversaciones leídas.
  var PRE = 'grupo_';

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function borrar(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function leerJSON(k) { try { return JSON.parse(leer(k) || 'null'); } catch (e) { return null; } }

  function texto(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
  // Para comparar lo que escribe la persona con los temas: sin mayúsculas ni tildes.
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function color(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : ''; }
  // Sólo https, una ruta de este mismo sitio o una imagen incrustada. Va a un <img>, nunca a HTML.
  function logo(v) {
    if (typeof v !== 'string') return '';
    var s = v.trim();
    return /^(https:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp|svg\+xml);)/i.test(s) && s.length < 300000 ? s : '';
  }
  function enlace(v) { var s = typeof v === 'string' ? v.trim() : ''; return /^https:\/\/[^\s"'<>]+$/i.test(s) && s.length < 500 ? s : ''; }
  // Blanco o tinta oscura, según cuál se lea mejor sobre el color de la entidad. 0.21 es donde el
  // contraste con blanco y con la tinta oscura se cruzan: de ahí para arriba gana la tinta.
  function tintaSobre(hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (x) {
      x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.21 ? '#16202b' : '#ffffff';
  }
  // Una huella de un texto. Sirve para reconocer «es lo mismo que ya vi» sin guardar en el teléfono
  // lo que dice. Se saca sin espacios, para que dé igual cómo venga cortado el texto.
  function huella(s) {
    var t = norm(s).replace(/\s+/g, ''), h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }

  function entidad(slug) {
    var s = String(slug || '').toLowerCase(), hallada = null;
    G.entidades.forEach(function (e) { if (e.slug === s) hallada = e; });
    return hallada;
  }

  // Los botones de arranque que la entidad configuró en su chat («Mis haberes», «Autorizar un
  // medicamento»…). `texto` es lo que el chat manda cuando la persona toca el botón; `enlace`,
  // adónde lleva si el botón es un enlace.
  function intenciones(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.map(function (i) {
      var etiqueta = texto(i && i.label, 60), url = i && i.accion === 'link' ? enlace(i.link) : '';
      return { etiqueta: etiqueta, texto: texto(i && (i.text || i.label), 200), enlace: url };
    }).filter(function (i) { return i.etiqueta && (i.texto || i.enlace); }).slice(0, 12);
  }

  /* ── La configuración del chat de cada entidad ─────────────────────────────────────────────────
   *
   * Se guarda con su hora y se reusa mientras esté fresca. La app y los chats la necesitan todo el
   * tiempo (al abrir, al cambiar de entidad, al volver a la app), y la plataforma frena los pedidos
   * POR CONEXIÓN, sumando a las tres entidades: detrás de la red de un mismo operador de celular
   * salen muchas personas con la misma dirección. Con esto hay, como mucho, un pedido de
   * configuración por entidad cada diez minutos por teléfono, la pida quien la pida.
   *
   * Se guarda tal como vino (no trae nada reservado: es lo mismo que recibe cualquier visitante),
   * para que el chat de adentro del marco pueda usarla sin volver a pedirla. Que una entidad NO
   * tenga el chat habilitado también se guarda, pero por poco tiempo: si lo habilitan, tiene que
   * verse enseguida.
   */
  var FRESCA_MS = 10 * 60 * 1000, FRESCA_NO_MS = 60 * 1000, MAX_GUARDAR = 60000;
  var enCurso = {};
  var clave = function (ent) { return PRE + 'cfg_' + ent.slug; };

  function resumir(cruda) {
    var b = (cruda && cruda.branding) || {};
    // El nombre, en el mismo orden que usa el chat para su encabezado: el del asesor si lo cargaron, si no el del bot.
    var nombre = (cruda && cruda.asesor && cruda.asesor.nombre) || (cruda && cruda.nombre);
    return { bot: texto(nombre, 40), color: color(b.color), logo: logo(b.logo), intenciones: intenciones(cruda && cruda.intenciones) };
  }
  // Lo último que se supo de la configuración de una entidad: { cfg, no, fresca } o null.
  function configGuardada(ent) {
    var g = leerJSON(clave(ent));
    if (!g || typeof g !== 'object') return null;
    var edad = Date.now() - (Number(g.en) || 0);
    if (g.no) return { cfg: null, no: true, fresca: edad < FRESCA_NO_MS };
    return g.cruda ? { cfg: resumir(g.cruda), no: false, fresca: edad < FRESCA_MS } : null;
  }
  // La configuración tal como vino, sólo si todavía está fresca. La usa el marco del chat.
  function configFresca(ent) {
    var g = leerJSON(clave(ent));
    return g && !g.no && g.cruda && Date.now() - (Number(g.en) || 0) < FRESCA_MS ? g.cruda : null;
  }
  function recibirConfig(ent, cruda) {
    var s = JSON.stringify({ en: Date.now(), cruda: cruda });
    if (s.length <= MAX_GUARDAR) guardar(clave(ent), s);
    return resumir(cruda);
  }
  function marcarNoDisponible(ent) { guardar(clave(ent), JSON.stringify({ en: Date.now(), no: true })); }

  /*
   * Devuelve una promesa con { estado, cfg }:
   *   ok      → el chat está habilitado; cfg trae el bot, el color, el logo y los botones de arranque
   *   no      → la entidad no tiene el chat habilitado para este sitio (la API contesta 400, 403 o 404)
   *   sinred  → no hubo respuesta útil; cfg es la última que se conocía, si había
   */
  function pedirConfig(ent) {
    var g = configGuardada(ent);
    if (g && g.fresca) return Promise.resolve(g.no ? { estado: 'no', cfg: null } : { estado: 'ok', cfg: g.cfg });
    if (enCurso[ent.slug]) return enCurso[ent.slug];
    var vieja = g && !g.no ? g.cfg : null;
    var p = fetch('/api/web-chat/config?key=' + encodeURIComponent(ent.clave), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 400 || r.status === 403 || r.status === 404) { marcarNoDisponible(ent); return { estado: 'no', cfg: null }; }
        if (!r.ok) return { estado: 'sinred', cfg: vieja };
        return r.json().then(function (cruda) {
          if (!cruda || cruda.ok === false) return { estado: 'sinred', cfg: vieja };
          return { estado: 'ok', cfg: recibirConfig(ent, cruda) };
        });
      })
      .catch(function () { return { estado: 'sinred', cfg: vieja }; })
      .then(function (res) { delete enCurso[ent.slug]; return res; });
    enCurso[ent.slug] = p;
    return p;
  }

  // ¿Hay una conversación empezada con esta entidad en este teléfono? El chat guarda ahí su credencial.
  function hayConversacion(ent) { return !!leer('webchat_token_' + ent.clave); }

  return {
    VERSION: VERSION, PRE: PRE, grupo: G, entidad: entidad, leer: leer, guardar: guardar, borrar: borrar, leerJSON: leerJSON,
    texto: texto, norm: norm, huella: huella, tintaSobre: tintaSobre,
    configGuardada: configGuardada, configFresca: configFresca, recibirConfig: recibirConfig,
    marcarNoDisponible: marcarNoDisponible, pedirConfig: pedirConfig, hayConversacion: hayConversacion
  };
}());
