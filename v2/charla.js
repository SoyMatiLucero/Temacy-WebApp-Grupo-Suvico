/*
 * El marco del chat de UNA entidad (charla.html?e=<slug>). La app (index.html) tiene un marco por
 * entidad: así los chats quedan vivos a la vez, pasar de uno a otro es instantáneo y ninguno se
 * entera del otro —cada marco es un documento aparte, con su propio chat de la plataforma adentro.
 *
 * Qué hace:
 *   · carga el chat (/widget.js) con la clave de la entidad y lo deja abierto ocupando el marco;
 *   · le cuenta a la app qué pasa (está listo, falló, qué hay en la conversación);
 *   · hace lo que la app pide (mandar una consulta, tocar un botón de arranque);
 *   · cuida que un chat que NO se está viendo no moleste: no toma el foco, no habla en voz alta y
 *     no llena la red de pedidos.
 *
 * El chat no expone ninguna forma de manejarlo, así que se lo maneja como lo haría una persona
 * —por su DOM— y se mira qué le pide al servidor. Todo lo que esto sabe del chat por dentro está
 * junto, en `SEL` (sus clases) y en `mirar()` (sus respuestas): si el chat cambia, se arregla ahí.
 */
(function () {
  'use strict';

  var C = window.Comun;
  var SEL = {
    boton: '.wcw-btn',                 // el botón redondo que abre el chat
    panel: '.wcw-panel',               // la ventana del chat
    abierto: 'wcw-on',                 // clase del panel cuando está abierto
    cargando: 'wcw-loading',           // clase del panel mientras pide su configuración
    error: '.wcw-err',                 // el cartel de error que dibuja el chat
    cabeza: '.wcw-head',
    punto: '.wcw-dot',                 // con la clase «espera»: la conversación pasó a una persona
    subtitulo: '.wcw-subtxt',          // «Te atiende Ana», «Derivado al equipo»…
    cuerpo: '.wcw-body',               // la lista de mensajes
    mensaje: '.wcw-m',                 // cada mensaje (lleva data-at con su hora)
    bienvenida: 'wcw-welcome',         // el saludo, que el chat escribe solo cada vez que abre
    mio: 'visitor',                    // mensajes de la persona
    equipo: 'operator',                // mensajes de una persona del equipo de la entidad
    sistema: 'system',                 // avisos del chat (no son de nadie)
    campo: '.wcw-foot input[type="text"]',
    enviar: '.wcw-send',
    arranque: '.wcw-ctas .wcw-intent', // los botones de arranque que configuró la entidad
    tramite: '.wcw-gestion',           // un trámite a medio completar
    pregunta: '.wcw-consent-ask:not(.wcw-gestion):not(.wcw-aviso):not(.wcw-reclamo)',   // el chat espera un sí o un no
    confirmacion: '.wcw-confirm'       // «¿Empezar de nuevo?»
  };

  var slug = new URLSearchParams(location.search).get('e');
  var ent = C.entidad(slug);
  // Abierta suelta o con una entidad que no existe: esto es una pieza de la app, se va a la app.
  if (!ent || window.parent === window) { location.replace('./' + (ent ? '?e=' + ent.slug : '')); return; }

  var ORIGEN = location.origin;
  var activo = false;           // ¿es este el chat que la persona está viendo?
  var listo = false, cerrado = false, panel = null, pendientes = [];
  var habiaConversacion = C.hayConversacion(ent);
  var red = { config: '', historial: false, tramite: false };   // lo que se sabe por los pedidos del chat

  function avisar(tipo, datos) {
    var m = { app: 'grupo', tipo: tipo, slug: ent.slug };
    if (datos) Object.keys(datos).forEach(function (k) { m[k] = datos[k]; });
    window.parent.postMessage(m, ORIGEN);
  }

  /* ── Un chat que no se está viendo no molesta ─────────────────────────────────────────────────
   *
   * FOCO. El chat le da el foco a su campo de texto solo (al abrirse, al terminar un trámite).
   * Suelto en una página está bien. Acá hay varios chats vivos a la vez, y el que cargaba DE FONDO
   * le sacaba el foco a lo que la persona estaba escribiendo en otro lado (se midió: se cortaba la
   * palabra a la mitad). `inert` en el marco no lo evita. Se resuelve en la fuente: dentro de este
   * documento, pedir el foco por programa sólo funciona si este chat es el que se ve Y el foco ya
   * está acá adentro (la persona lo está usando). Así el chat sigue manejando su foco como siempre
   * mientras se lo usa, pero no se lo puede sacar a otra parte de la app ni abrir el teclado del
   * teléfono con sólo entrar a una conversación. Tocar con el dedo o el mouse no pasa por acá.
   * Cuando es la app la que quiere el foco en el campo, usa `focoDeFabrica`.
   *
   * VOZ. Si la persona activó «leer las respuestas en voz alta» en un chat y pasó a otro, el
   * primero seguía leyendo lo que le llegaba. Un chat que no se ve no habla.
   */
  var focoDeFabrica = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () {
    if (!activo || !document.hasFocus()) return;
    return focoDeFabrica.apply(this, arguments);
  };
  try {
    if (window.SpeechSynthesis && SpeechSynthesis.prototype.speak) {
      var hablarDeFabrica = SpeechSynthesis.prototype.speak;
      SpeechSynthesis.prototype.speak = function (frase) { if (activo) return hablarDeFabrica.call(this, frase); };
    }
  } catch (e) {}
  function callar() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
  function soltarFoco() { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }

  /* ── Mirar lo que el chat le pide al servidor ─────────────────────────────────────────────────
   *
   * Se envuelve `fetch` ANTES de cargar el chat. No se hace ningún pedido propio: sólo se mira lo
   * que el chat ya pide, que dice cosas que su DOM no dice (si la entidad tiene el chat habilitado,
   * cuándo terminó de cargar el historial, si quedó un trámite a medias).
   *
   * Y se evitan dos pedidos que sobran:
   *   · la configuración, si la app ya la tiene fresca (ver comun.js): se le contesta con esa;
   *   · la consulta periódica de mensajes de un chat que NO se está viendo. El chat consulta cada
   *     4 segundos cuando no logra conectarse en vivo; con tres chats abiertos eso son 45 pedidos
   *     por minuto, y la plataforma frena por conexión. De fondo se espacia a una cada 20 segundos
   *     (cada 60 con la app fuera de la vista), contestándole mientras tanto con lo último que
   *     vino. El chat que se está viendo consulta a su ritmo.
   */
  var fetchDeFabrica = window.fetch;
  var ultimaLista = null;        // la última respuesta de la consulta de mensajes: { en, status, cuerpo }
  var ultimoCambio = 0;          // cuándo cambió por última vez lo que hay en pantalla
  function respuesta(status, cuerpo) { return new Response(cuerpo, { status: status, headers: { 'Content-Type': 'application/json' } }); }

  window.fetch = function (recurso, opciones) {
    var que = '';
    try {
      var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      var metodo = String((opciones && opciones.method) || (recurso && recurso.method) || 'GET').toUpperCase();
      que = (/\/api\/web-chat\/(config|messages|message|gestion)(?=[\/?]|$)/.exec(url) || [])[1] || '';
      if (que === 'config' && metodo === 'GET') {
        var fresca = C.configFresca(ent);
        if (fresca) { red.config = 'ok'; setTimeout(decidir, 0); return Promise.resolve(respuesta(200, JSON.stringify(fresca))); }
      }
      if (que === 'messages' && metodo === 'GET' && ultimaLista && (!activo || document.hidden)) {
        var espera = document.hidden ? 60000 : 20000;
        // Sólo se repite lo último si la pantalla no cambió después por otra vía (un mensaje en vivo):
        // repetir una lista más vieja que la pantalla haría desaparecer mensajes por un rato.
        if (Date.now() - ultimaLista.en < espera && ultimoCambio <= ultimaLista.en + 5000) {
          return Promise.resolve(respuesta(ultimaLista.status, ultimaLista.cuerpo));
        }
      }
    } catch (e) { que = ''; }
    var promesa = fetchDeFabrica.apply(this, arguments);
    if (que) promesa.then(function (r) { mirar(que, r.status, r.clone()); }, function () { mirar(que, 0, null); });
    return promesa;
  };

  function mirar(que, status, copia) {
    try {
      if (que === 'config') {
        if (status === 400 || status === 403 || status === 404) { red.config = 'no'; C.marcarNoDisponible(ent); return decidir(); }
        if (status !== 200 || !copia) { red.config = 'falla'; return decidir(); }
        return void copia.json().then(function (cruda) {
          if (!cruda || cruda.ok === false) red.config = 'falla';
          else { red.config = 'ok'; C.recibirConfig(ent, cruda); }
          decidir();
        }, function () { red.config = 'falla'; decidir(); });
      }
      if (!copia) return;
      if (que === 'messages') {
        var en = Date.now();
        return void copia.text().then(function (cuerpo) {
          ultimaLista = { en: en, status: status, cuerpo: cuerpo };
          if (status !== 200) return;
          red.historial = true;
          try { var lista = JSON.parse(cuerpo); if (lista && typeof lista === 'object') red.tramite = !!lista.gestion; } catch (e) {}
          programarConteo();
        }, function () {});
      }
      // Mandar un mensaje o avanzar un trámite: ¿quedó un trámite a medias?
      if (status === 200) copia.json().then(function (b) {
        if (!b || typeof b !== 'object') return;
        if (b.gestion_completa || b.gestion_cancelada) red.tramite = false;
        else if (b.gestion && typeof b.gestion === 'object') red.tramite = true;
      }, function () {});
    } catch (e) {}
  }

  /* ── Lo que se ve mientras carga o si no se pudo ──────────────────────────────────────────── */
  var estadoEl = document.getElementById('estado');
  var estadoTxt = document.getElementById('estado-texto');
  var reintentar = document.getElementById('reintentar');
  var limite = 0;
  function mostrarEstado(estado, msj, conReintento) {
    estadoEl.hidden = estado === 'listo';
    estadoEl.setAttribute('data-estado', estado);
    estadoTxt.textContent = msj || '';
    reintentar.hidden = !conReintento;
    avisar('estado', { estado: estado });
  }
  function terminar(estado, msj, conReintento) { cerrado = true; clearTimeout(limite); mostrarEstado(estado, msj, conReintento); }
  reintentar.onclick = function () { location.reload(); };
  window.addEventListener('online', function () { if (!listo) location.reload(); });

  // El color de la entidad, para que el esqueleto de carga ya sea «el de ella».
  var guardada = C.configGuardada(ent);
  var colorMarca = (guardada && guardada.cfg && guardada.cfg.color) || ent.color;
  document.documentElement.style.setProperty('--marca', colorMarca);
  document.documentElement.style.setProperty('--marca-tinta', C.tintaSobre(colorMarca));
  mostrarEstado('cargando', 'Abriendo el chat de ' + ent.nombre + '…');

  /* ── Cargar el chat y dejarlo abierto ─────────────────────────────────────────────────────────
   *
   * El chat pide su configuración apenas carga, sin esperar a que lo abran. Abrirlo ANTES de que
   * esa respuesta llegue hace que la pida otra vez, y con dos respuestas quedan dos oyentes en sus
   * botones de voz y de micrófono (el de voz deja de andar y el micrófono graba doble). Por eso se
   * espera a que termine: recién ahí se lo abre.
   */
  var vigia = new MutationObserver(function () { decidir(); });
  var vigiaPanel = null;
  vigia.observe(document.body, { childList: true });
  limite = setTimeout(function () { if (!listo && !cerrado) terminar('fallo', 'No pudimos abrir el chat.', true); }, 15000);

  var guion = document.createElement('script');
  guion.src = '/widget.js';
  guion.async = true;
  guion.setAttribute('data-key', ent.clave);
  guion.onerror = function () { if (!listo) terminar('sinred', 'No pudimos cargar el chat. Revisá tu conexión.', true); };
  document.body.appendChild(guion);

  function decidir() {
    if (listo || cerrado) return;
    if (red.config === 'no') return terminar('no', 'El chat de ' + ent.nombre + ' no está disponible en este momento.', false);
    if (red.config === 'falla') return terminar('sinred', 'No pudimos conectar. Revisá tu conexión.', true);
    var p = document.querySelector(SEL.panel), b = document.querySelector(SEL.boton);
    if (!p || !b) return;
    if (!vigiaPanel) {          // el panel avisa cuando deja de estar «cargando»
      vigiaPanel = new MutationObserver(function () { decidir(); });
      vigiaPanel.observe(p, { attributes: true, attributeFilter: ['class'] });
    }
    if (red.config !== 'ok' || p.classList.contains(SEL.cargando)) return;
    if (p.querySelector(SEL.error)) return terminar('sinred', 'No pudimos conectar. Revisá tu conexión.', true);
    preparar(p, b);
  }

  function preparar(p, boton) {
    panel = p;
    vigia.disconnect();
    vigiaPanel.disconnect();
    clearTimeout(limite);

    var abrir = function () { if (!panel.classList.contains(SEL.abierto)) boton.click(); };
    abrir();
    // Acá el chat es la pantalla: si algo lo cierra, se vuelve a abrir. (La cruz está escondida.)
    new MutationObserver(abrir).observe(panel, { attributes: true, attributeFilter: ['class'] });

    var cuerpo = panel.querySelector(SEL.cuerpo), cabeza = panel.querySelector(SEL.cabeza);
    if (cuerpo) new MutationObserver(function () { ultimoCambio = Date.now(); programarConteo(); })
      .observe(cuerpo, { childList: true, subtree: true, characterData: true });
    if (cabeza) new MutationObserver(programarConteo)
      .observe(cabeza, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });

    listo = true;
    mostrarEstado('listo');
    contar();
    pendientes.splice(0).forEach(function (hacer) { hacer(); });
  }

  /* ── Qué hay en la conversación ───────────────────────────────────────────────────────────────
   *
   * Se mira cómo QUEDÓ la pantalla, no cada cambio: el chat mueve y vuelve a crear sus mensajes
   * (al cargar el historial los borra todos y los pinta de nuevo), y una respuesta larga del bot
   * sale en varias burbujas que después, en el historial, son una sola.
   */
  var relojConteo = 0;
  function programarConteo() { clearTimeout(relojConteo); relojConteo = setTimeout(contar, 300); }

  function textoDe(nodo) {
    var t = C.texto(nodo.innerText || nodo.textContent || '', 4000);
    return t || (nodo.querySelector('img, video, audio, a') ? 'Archivo adjunto' : '');
  }
  // ¿La conversación pasó a una persona del equipo? El chat lo dice en su encabezado.
  function caso() {
    var punto = panel.querySelector(SEL.punto), sub = panel.querySelector(SEL.subtitulo);
    var t = C.texto(sub ? sub.textContent : '', 60);
    if (punto && punto.classList.contains('espera')) return t || 'Derivado al equipo';
    return /^Te atiende /i.test(t) ? t : '';
  }
  function contar() {
    if (!listo) return;
    var nodos = panel.querySelectorAll(SEL.cuerpo + ' ' + SEL.mensaje);
    var ultimo = null, deEllos = null;
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i], cl = n.classList;
      if (cl.contains(SEL.bienvenida) || cl.contains(SEL.sistema)) continue;   // el saludo y los avisos no son de nadie
      var t = textoDe(n);
      if (!t) continue;
      var rol = cl.contains(SEL.mio) ? 'yo' : cl.contains(SEL.equipo) ? 'equipo' : 'bot';
      var at = n.getAttribute('data-at') || '';
      ultimo = { rol: rol, texto: t.slice(0, 160), at: at };
      if (rol !== 'yo') deEllos = { rol: rol, at: at, huella: C.huella(t) };
    }
    avisar('mensajes', {
      ultimo: ultimo, deEllos: deEllos, caso: caso(),
      // «asentado»: ya se cargó lo que había de antes, así que lo que aparezca desde acá es nuevo.
      asentado: !habiaConversacion || red.historial
    });
  }

  /* ── Lo que pide la app ───────────────────────────────────────────────────────────────────── */
  function cuandoListo(hacer) { if (listo) hacer(); else if (!cerrado) pendientes.push(hacer); }

  // Mandar un texto escrito fuera del chat es delicado: si hay un trámite a medias, el servidor lo
  // toma como la respuesta al paso pendiente. En ese caso (y si el chat está esperando un sí o un
  // no) NO se manda: se deja escrito en el campo, para que la persona decida.
  function traba() {
    if (red.tramite || panel.querySelector(SEL.tramite)) return 'tramite';
    if (panel.querySelector(SEL.pregunta)) return 'pregunta';
    return '';
  }
  function noEnviado(texto, motivo) {
    var campo = panel.querySelector(SEL.campo), escrito = false;
    if (campo) {
      if (!campo.value.trim()) { campo.value = texto; campo.dispatchEvent(new Event('input', { bubbles: true })); }
      escrito = campo.value === texto;
    }
    avisar('sin-enviar', { motivo: motivo, escrito: escrito });
  }
  function mandar(texto, vuelta) {
    var campo = panel.querySelector(SEL.campo), boton = panel.querySelector(SEL.enviar);
    if (!campo || !boton) return noEnviado(texto, 'fallo');
    var motivo = traba();
    if (motivo) return noEnviado(texto, motivo);
    if (campo.value.trim() && campo.value !== texto) return noEnviado(texto, 'borrador');   // lo que la persona tenía escrito no se pisa
    if (boton.disabled) {       // el chat está mandando otra cosa: no encola, hay que esperarlo
      if ((vuelta || 0) < 60) return void setTimeout(function () { mandar(texto, (vuelta || 0) + 1); }, 250);
      return noEnviado(texto, 'ocupado');
    }
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    boton.click();
    if (campo.value === '') avisar('enviado'); else noEnviado(texto, 'fallo');   // al mandar, el chat vacía el campo
  }
  // Un botón de arranque: si el chat lo está mostrando, se toca el del chat (que sabe abrir el
  // trámite que corresponda). Si no —la conversación ya empezó y el chat los sacó— se manda su
  // texto, que es lo mismo que hace el chat en el primer contacto.
  function tocarArranque(etiqueta, texto, vuelta) {
    var botones = panel.querySelectorAll(SEL.arranque);
    for (var i = 0; i < botones.length; i++) {
      if (C.texto(botones[i].textContent, 60) === etiqueta && botones[i].offsetParent !== null) { botones[i].click(); return avisar('enviado'); }
    }
    // Conversación sin empezar: los botones aparecen un momento después del saludo. Se los espera un poco.
    if (!panel.querySelector(SEL.cuerpo + ' .' + SEL.mio) && (vuelta || 0) < 8) {
      return void setTimeout(function () { tocarArranque(etiqueta, texto, (vuelta || 0) + 1); }, 250);
    }
    mandar(texto);
  }
  // Al volver a la app después de un rato: el chat no vuelve a pedir lo que llegó mientras estaba
  // desconectado, así que se lo recarga. Sólo si no se pierde nada que la persona tenía a medias.
  function refrescar() {
    if (!listo) return;
    var campo = panel.querySelector(SEL.campo), boton = panel.querySelector(SEL.enviar);
    if (!C.hayConversacion(ent) || (campo && campo.value.trim()) || (boton && boton.disabled)) return;
    if (panel.querySelector(SEL.tramite) || panel.querySelector(SEL.pregunta) || panel.querySelector(SEL.confirmacion)) return;
    location.reload();
  }

  // La app pide el foco en el campo (pantalla ancha, al elegir una conversación). Recién abierto,
  // el chat todavía no deja enfocar su campo: se insiste unas pocas veces, y se suelta si en el
  // medio este chat dejó de ser el que se ve.
  function darFoco(vuelta) {
    var campo = panel.querySelector(SEL.campo);
    if (!campo || !activo) return;
    focoDeFabrica.call(campo, { preventScroll: true });
    if (document.activeElement !== campo && vuelta < 5) setTimeout(function () { darFoco(vuelta + 1); }, 80);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGEN || e.source !== window.parent) return;
    var m = e.data;
    if (!m || m.app !== 'grupo') return;
    if (m.tipo === 'activar') {
      activo = !!m.activo;
      if (!activo) { soltarFoco(); callar(); return; }
      if (m.foco) cuandoListo(function () { darFoco(0); });
    } else if (m.tipo === 'teclado') {
      document.documentElement.classList.toggle('teclado', !!m.abierto);
    } else if (m.tipo === 'enviar' && typeof m.texto === 'string') {
      var t = C.texto(m.texto, 2000);
      if (t) cuandoListo(function () { mandar(t); });
    } else if (m.tipo === 'arranque' && typeof m.etiqueta === 'string') {
      var etiqueta = C.texto(m.etiqueta, 60), texto = C.texto(typeof m.texto === 'string' ? m.texto : '', 200) || etiqueta;
      if (etiqueta) cuandoListo(function () { tocarArranque(etiqueta, texto); });
    } else if (m.tipo === 'refrescar') {
      refrescar();
    }
  });

  avisar('hola', { version: C.VERSION });   // ya se puede hablar con este marco: la app contesta dónde está parado
}());
