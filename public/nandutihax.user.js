// ==UserScript==
// @name         ÑandutíHax
// @namespace    https://nandutihax.com/
// @version      1.11.1
// @description  Un panel de ÑandutíHax arriba del juego: el marcador, quién está en cancha y el ELO de cada uno, en vivo.
// @author       Jinder
// @icon         https://nandutihax.com/img/logo-chico.png
// @match        https://*.haxball.com/*
// @match        https://nandutihax.com/*
// @connect      nandutihax.com
// @grant        none
// @downloadURL  https://nandutihax.com/nandutihax.user.js
// @updateURL    https://nandutihax.com/nandutihax.user.js
// @run-at       document-start
// ==/UserScript==

// =============================================================================
// QUÉ HACE
//
// Dos cosas, en dos ventanas distintas:
//
//   1. En la página de HaxBall, un panel al costado con el marcador de la sala que elijas,
//      quién está en cada equipo y el ELO de cada uno. Sale de
//      https://nandutihax.com/api/publico/salas, que devuelve solo eso.
//   2. Adentro del juego (el iframe game.html), el CARTEL DE GOL: cuando alguien convierte,
//      **se saca** el "Blue Scores!" de HaxBall —no se dibuja más, ver
//      sacarElCartelDeHaxball()— y en su lugar aparece el cartel que el goleador compró en
//      la tienda. Ver también arrancarCartelDeGol().
//
// Los datos se piden con un fetch común: /api/publico/salas manda
// Access-Control-Allow-Origin: *, así que no hace falta GM_xmlhttpRequest ni ningún permiso
// del gestor. Por eso va con @grant none, que además hace que el script corra en el mundo de
// la página y no en uno aparte — que es donde el parche del lienzo tiene que estar.
//
// Es un userscript (Tampermonkey/Violentmonkey) y no una extensión de la tienda de Chrome:
// se instala con un clic y no hay que esperar ninguna revisión.
// =============================================================================

const VERSION_INSTALADA = "1.11.1";
const API_SALAS = "https://nandutihax.com/api/publico/salas";

// ── SOLO EN LAS SALAS DE ÑANDUTÍHAX ──────────────────────────────────────────────────
// La extensión no trabaja en cualquier sala de HaxBall: solo en las nuestras. La sala se
// reconoce por el código del link (…/play?c=XXXX), comparándolo con el de las salas que
// devuelve nuestra API. Si no coincide, no se dibuja el panel, no salen carteles y el
// cartel de HaxBall queda como estaba.
function esNuestraWeb() {
  return /(^|\.)nandutihax\.com$/i.test(location.hostname);
}

// ¿Es un dispositivo táctil? Lo usan el joystick y el arreglo de la franja de anuncios: los
// dos son cosas que solo hacen falta en el celular, y en desktop no tienen que tocar nada.
function esTactil() {
  try { return navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches; }
  catch (e) { return "ontouchstart" in window; }
}

// Adentro del juego el código no está en la URL del iframe, sino en la ventana de arriba
function codigoDeLaSala() {
  try {
    const arriba = window.top && window.top.location ? window.top.location.href : location.href;
    return new URL(arriba).searchParams.get("c") || "";
  } catch (e) {
    try { return new URL(location.href).searchParams.get("c") || ""; } catch (e2) { return ""; }
  }
}

const esDeNandutihax = (salas, codigo) =>
  Boolean(codigo) && (salas || []).some((s) => String(s.link || "").indexOf(codigo) >= 0);

// ¿Se muestra el panel? Adentro de una sala, SOLO si es nuestra. Pero en la pantalla de
// HaxBall (sin sala todavía, o sea sin ?c= en la dirección) también se muestra: es donde se
// mira qué salas hay y por dónde entrar. Si no, el panel "desaparecía" y parecía roto:
// con las salas cerradas no había ningún link contra el cual comparar.
const sePuedeVerElPanel = (salas, codigo) => !codigo || esDeNandutihax(salas, codigo);

// ── LAS MARCAS INVISIBLES DEL HOST ────────────────────────────────────────────────────
// El host firma sus avisos con dos caracteres de ancho cero (parches/bloques/scores.txt y
// momentos.txt). No se ven en el chat de nadie, y son lo único que distingue un aviso
// nuestro de cualquier otro… así que también sirven para reconocer la sala DESDE ADENTRO,
// sin depender de la dirección: si llega un aviso firmado, estamos en una sala nuestra.
const MARCAS = {
  sala:     "​⁢",   // "esto es ÑandutíHax" (va en la bienvenida; no dibuja nada)
  gol:      "​​",
  inicio:   "​‌",
  victoria: "​⁠",
  tiempo:   "​⁡",
};

const esUnAvisoNuestro = (texto) =>
  Object.keys(MARCAS).some((k) => texto.indexOf(MARCAS[k]) >= 0);

// Lo que la extensión necesita saber de afuera: qué salas hay y cómo es el cartel de inicio
async function pedirLoNuestro() {
  try {
    const r = await fetch(API_SALAS + "?t=" + Date.now(), { cache: "no-store", credentials: "omit" });
    return await r.json();
  } catch (e) { return null; }
}

// El parche del lienzo mira este atributo en cada dibujo, así que la marca es la forma de
// prenderlo y apagarlo desde acá (el <html> se ve desde los dos mundos)
function marcarActiva(si) {
  const valor = si ? "si" : "no";
  try {
    // Solo si cambió: escribir un atributo hace trabajar al navegador al pedo
    if (document.documentElement.getAttribute("data-nh-activo") !== valor) {
      document.documentElement.setAttribute("data-nh-activo", valor);
    }
  } catch (e) {}
}

let loNuestro = { salas: [], inicio: null, victoria: null, tiempo: null, nuestra: false };

// ── RECONOCER LA SALA SIN LA DIRECCIÓN ────────────────────────────────────────────────
// Comparar el ?c= de la dirección con los links de la API alcanza cuando se entra por un
// link nuestro, PERO no cuando se entra desde la lista de salas de HaxBall: ahí la
// dirección no tiene ningún código y la extensión se quedaba apagada (el cartel de HaxBall
// salía y el nuestro no). Desde la 1.7.0, un aviso firmado por el host también la prende.
let confirmadaPorElChat = false;

function confirmarSalaNuestra() {
  if (confirmadaPorElChat) return;
  confirmadaPorElChat = true;
  loNuestro.nuestra = true;
  marcarActiva(true);
}

// Al salir de la sala (HaxBall rehace la pantalla) se vuelve a empezar: si no, la extensión
// quedaría prendida adentro de una sala ajena a la que se entre después.
function olvidarLaSala() {
  if (!confirmadaPorElChat) return;
  confirmadaPorElChat = false;
  loNuestro.nuestra = esDeNandutihax(loNuestro.salas, codigoDeLaSala());
  marcarActiva(loNuestro.nuestra);
}

function vigilarSiEsSalaNuestra() {
  const preguntar = async () => {
    const datos = await pedirLoNuestro();
    if (datos) {
      loNuestro = {
        salas: datos.salas || [],
        inicio: datos.inicio || null,
        victoria: datos.victoria || null,
        tiempo: datos.tiempo || null,
        nuestra: confirmadaPorElChat || esDeNandutihax(datos.salas, codigoDeLaSala()),
      };
    }
    marcarActiva(loNuestro.nuestra);
  };
  preguntar();
  // Si la sala no es nuestra, la extensión no hace nada: con preguntar de vez en cuando alcanza
  setInterval(() => { if (!document.hidden) preguntar(); }, 60000);
  // El <html> se reemplaza al cargar el juego y la marca se pierde: se vuelve a poner
  setInterval(() => marcarActiva(loNuestro.nuestra), 2000);
}

function arrancarNandutiHax() {
  "use strict";

  const VERSION = VERSION_INSTALADA;
  const API = API_SALAS;
  const CADA = 4000;          // cada cuánto se refresca mientras se está en una sala nuestra
  const CADA_LENTO = 30000;   // …y si no es una sala nuestra (el panel ni se muestra)
  const LLAVE = "nandutihax_panel";

  // El userscript corre también en iframes; el panel va una sola vez, en la ventana de arriba
  if (window.top !== window.self) return;

  const guardado = (() => {
    try { return JSON.parse(localStorage.getItem(LLAVE) || "{}"); } catch (e) { return {}; }
  })();
  const guardar = (datos) => {
    try { localStorage.setItem(LLAVE, JSON.stringify(Object.assign(guardado, datos))); } catch (e) {}
  };

  let sala = guardado.sala || null;      // la que se está mirando
  let abierto = guardado.abierto !== false;
  let salas = [];
  let reloj = null;
  let ultimaFirma = "";          // para no redibujar el panel si nada cambió
  let enUnaSalaNuestra = false;

  // ── El pedido. Un fetch común: la API manda Access-Control-Allow-Origin: * ──
  // Antes iba por GM_xmlhttpRequest y el gestor lo frenaba con "Blocked by @connect CORS
  // check" si el permiso no estaba guardado: el panel quedaba sin datos y nadie sabía por qué.
  const pedir = async () => {
    try {
      const r = await fetch(API + "?t=" + Date.now(), { cache: "no-store", credentials: "omit" });
      return await r.json();
    } catch (e) { /* si falla, probamos con el gestor, por si alguno bloquea el fetch */ }
    return new Promise((listo) => {
      const gm = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest
        : (typeof GM !== "undefined" && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
      if (!gm) return listo(null);
      gm({
        method: "GET",
        url: API + "?t=" + Date.now(),
        timeout: 8000,
        onload: (r) => { try { listo(JSON.parse(r.responseText)); } catch (e) { listo(null); } },
        onerror: () => listo(null),
        ontimeout: () => listo(null),
      });
    });
  };

  // ── El panel ──
  const css = `
    #nh-panel {
      position: fixed; top: 44px; right: 12px; z-index: 2147483647;
      /* Nunca más ancho que la pantalla: en un celular angosto se achica solo en vez de
         desbordar (268px es lo pensado para desktop; los 24px son los 12px de cada lado) */
      width: min(268px, calc(100vw - 24px));
      font-family: Inter, system-ui, "Segoe UI", sans-serif; font-size: 13px;
      color: #e8edf2; background: rgba(23, 32, 38, .94); border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px; box-shadow: 0 10px 34px rgba(0,0,0,.45); overflow: hidden;
      backdrop-filter: blur(6px);
    }
    #nh-panel * { box-sizing: border-box; }
    #nh-cabeza {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: rgba(255,255,255,.06); cursor: move; user-select: none;
    }
    #nh-cabeza img { width: 18px; height: 18px; }
    #nh-cabeza b { flex: 1; font-size: 12px; letter-spacing: .02em; }
    #nh-cabeza button {
      background: transparent; border: 0; color: #9fb0bd; cursor: pointer;
      font-size: 15px; line-height: 1; padding: 2px 4px;
    }
    #nh-cabeza button:hover { color: #fff; }
    #nh-joystick-alternar.apagado { opacity: .45; }
    #nh-cuerpo { padding: 10px; display: grid; gap: 10px; }
    #nh-panel.cerrado #nh-cuerpo { display: none; }
    #nh-salas { display: flex; gap: 4px; flex-wrap: wrap; }
    #nh-salas button {
      flex: 1; min-width: 56px; padding: 4px 6px; font-size: 11px; font-weight: 600;
      background: rgba(255,255,255,.07); color: #c7d3dc; border: 1px solid transparent;
      border-radius: 6px; cursor: pointer;
    }
    #nh-salas button.elegida { background: #2563eb; color: #fff; }
    #nh-salas button.cerrada { opacity: .45; }
    .nh-marcador {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 8px; background: rgba(0,0,0,.25); border-radius: 8px;
    }
    .nh-marcador .n { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .nh-cuadro { width: 13px; height: 13px; border-radius: 3px; }
    .nh-equipo { display: grid; gap: 3px; }
    .nh-equipo .tit {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9fb0bd;
    }
    .nh-jug { display: flex; align-items: center; gap: 6px; padding: 1px 0; }
    .nh-jug .elo { margin-left: auto; font-size: 11px; color: #9fb0bd; font-variant-numeric: tabular-nums; }
    .nh-vacio { color: #7d8b92; font-size: 12px; }
    #nh-pie { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #7d8b92; }
    #nh-pie a { color: #7fb0ff; text-decoration: none; margin-left: auto; }
    #nh-estado { font-size: 10px; color: #6c7a85; border-top: 1px solid rgba(255,255,255,.07); padding-top: 6px; }
    #nh-estado b { color: #8fd694; font-weight: 600; }
    #nh-estado i { color: #e58b6e; font-style: normal; font-weight: 600; }
  `;

  const estilo = document.createElement("style");
  estilo.textContent = css;
  (document.head || document.documentElement).appendChild(estilo);

  const panel = document.createElement("div");
  panel.id = "nh-panel";
  // Adentro de una sala arranca escondido hasta saber si es nuestra; en la pantalla de
  // HaxBall se muestra en el acto, sin esperar la respuesta de la API.
  panel.style.display = codigoDeLaSala() ? "none" : "";
  if (!abierto) panel.classList.add("cerrado");
  panel.innerHTML = `
    <div id="nh-cabeza">
      <img src="https://nandutihax.com/img/logo-chico.png" alt="">
      <b>ÑandutíHax</b>
      <button id="nh-joystick-alternar" title="Mostrar u ocultar el joystick"${esTactil() ? "" : " hidden"}>🕹️</button>
      <button id="nh-plegar" title="Mostrar u ocultar">${abierto ? "–" : "+"}</button>
    </div>
    <div id="nh-cuerpo">
      <div id="nh-salas"></div>
      <div id="nh-contenido"><div class="nh-vacio">Buscando las salas…</div></div>
      <div id="nh-pie"><span id="nh-cuando">—</span><a href="https://nandutihax.com" target="_blank">nandutihax.com</a></div>
      <div id="nh-estado" title="Versión de la extensión y si le sacó el cartel a HaxBall">—</div>
    </div>`;
  // HaxBall rehace su pantalla cuando entrás a una sala, así que el panel se vuelve a poner
  // si desapareció (y el estilo con él).
  const montar = () => {
    if (!document.body) return;
    if (!estilo.isConnected) (document.head || document.documentElement).appendChild(estilo);
    if (!panel.isConnected) document.body.appendChild(panel);
  };
  montar();
  // Para poder comprobar en la consola (F12) que la versión nueva está andando
  console.log("[NandutiHax] panel listo, version " + VERSION);

  // Se acuerda de dónde lo dejaste
  if (guardado.x !== undefined && guardado.y !== undefined) {
    panel.style.left = guardado.x + "px";
    panel.style.top = guardado.y + "px";
    panel.style.right = "auto";
  }

  const $ = (id) => document.getElementById(id);

  $("nh-plegar").onclick = () => {
    abierto = !abierto;
    panel.classList.toggle("cerrado", !abierto);
    $("nh-plegar").textContent = abierto ? "–" : "+";
    guardar({ abierto });
  };

  // El interruptor del joystick: escribe la MISMA llave de localStorage que lee
  // arrancarJoystick() adentro del iframe del juego. Panel e iframe son el mismo origen
  // (www.haxball.com), así que ya comparten localStorage solo — no hace falta mandarle
  // ningún mensaje al iframe. El joystick relee esa llave cada 1 s y se entera solo.
  const LLAVE_JOYSTICK = "nandutihax_joystick";
  const joystickOculto = () => { try { return localStorage.getItem(LLAVE_JOYSTICK) === "oculto"; } catch (e) { return false; } };
  const pintarJoystickAlternar = () => {
    $("nh-joystick-alternar").classList.toggle("apagado", joystickOculto());
  };
  pintarJoystickAlternar();
  $("nh-joystick-alternar").onclick = () => {
    try { localStorage.setItem(LLAVE_JOYSTICK, joystickOculto() ? "visible" : "oculto"); } catch (e) {}
    pintarJoystickAlternar();
  };

  // Arrastrar el panel
  (function arrastrable() {
    const cabeza = $("nh-cabeza");
    let llevando = false, dx = 0, dy = 0;
    cabeza.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("button")) return;
      llevando = true;
      const caja = panel.getBoundingClientRect();
      dx = ev.clientX - caja.left;
      dy = ev.clientY - caja.top;
      cabeza.setPointerCapture(ev.pointerId);
    });
    cabeza.addEventListener("pointermove", (ev) => {
      if (!llevando) return;
      const x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - dx));
      const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";
    });
    cabeza.addEventListener("pointerup", () => {
      if (!llevando) return;
      llevando = false;
      const caja = panel.getBoundingClientRect();
      guardar({ x: Math.round(caja.left), y: Math.round(caja.top) });
    });
  })();

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function pintarSalas() {
    $("nh-salas").innerHTML = salas.map((s) => `
      <button data-sala="${esc(s.clave)}" class="${s.clave === sala ? "elegida" : ""}${s.abierta ? "" : " cerrada"}"
              title="${esc(s.nombre)}${s.abierta ? "" : " (cerrada)"}">${esc(s.nombre.replace(/^Futsal\s*/i, ""))}</button>`).join("");
  }

  $("nh-salas").onclick = (ev) => {
    const b = ev.target.closest("[data-sala]");
    if (!b) return;
    sala = b.dataset.sala;
    guardar({ sala });
    ultimaFirma = "";            // cambió de sala a mano: hay que redibujar sí o sí
    pintarSalas();
    pintarSala();
  };

  function pintarSala() {
    const s = salas.find((x) => x.clave === sala) || salas[0];
    if (!s) {
      $("nh-contenido").innerHTML = '<div class="nh-vacio">No se pudo hablar con ÑandutíHax.</div>';
      return;
    }

    const equipo = (n, color, titulo) => {
      const suyos = s.jugadores.filter((j) => j.equipo === n);
      return `
        <div class="nh-equipo">
          <div class="tit"><span class="nh-cuadro" style="background:${color}"></span>${titulo} (${suyos.length})</div>
          ${suyos.length
            ? suyos.map((j) => `
              <div class="nh-jug">
                <span>${esc(j.emoji || "")}</span><span>${esc(j.nombre)}</span>
                <span class="elo">${j.elo === null ? "" : j.elo}</span>
              </div>`).join("")
            : '<div class="nh-vacio">nadie</div>'}
        </div>`;
    };

    const mirando = s.jugadores.filter((j) => j.equipo === 0).length;
    $("nh-contenido").innerHTML = `
      <div class="nh-marcador">
        <span class="nh-cuadro" style="background:#e56e56"></span>
        <span class="n">${s.marcador.red}</span>
        <span style="color:#7d8b92">–</span>
        <span class="n">${s.marcador.blue}</span>
        <span class="nh-cuadro" style="background:#5689e5"></span>
      </div>
      ${equipo(1, "#e56e56", "Rojo")}
      ${equipo(2, "#5689e5", "Azul")}
      <div class="nh-vacio">${mirando} mirando · ${s.cuantos} en la sala${s.abierta ? "" : " · cerrada"}</div>`;

    $("nh-cuando").textContent = s.marcador.enJuego ? "jugando" : "sin partido";
    pintarEstado();
  }

  // Qué versión está corriendo y si el parche del lienzo quedó puesto adentro del juego.
  // Esto se mira en el HTML del iframe (`data-nh-cartel`), que es lo único que se ve desde
  // los dos mundos. Está a la vista en el panel a propósito: que nadie tenga que abrir la
  // consola para saber si la extensión está haciendo lo que promete.
  function pintarEstado() {
    const caja = $("nh-estado");
    if (!caja) return;
    let cartel = '<i>no se pudo mirar</i>';
    try {
      const marco = document.querySelector('iframe[src*="game.htm"], iframe[src*="game.html"]');
      const raiz = marco && marco.contentDocument && marco.contentDocument.documentElement;
      if (raiz) {
        const bloqueos = raiz.getAttribute("data-nh-bloqueos");
        cartel = raiz.getAttribute("data-nh-cartel") === "puesto"
          ? "<b>sin el cartel de HaxBall</b>" + (bloqueos ? " (" + bloqueos + ")" : "")
          : "<i>el cartel de HaxBall sigue puesto</i>";
      }
    } catch (e) { /* si el navegador no deja mirar el iframe, queda el aviso de arriba */ }
    caja.innerHTML = "v" + VERSION + " · " + cartel;
  }

  async function refrescar() {
    montar();
    pintarEstado();
    const datos = await pedir();
    if (!datos || !datos.ok) {
      $("nh-contenido").innerHTML = '<div class="nh-vacio">No se pudo hablar con ÑandutíHax.</div>';
      return;
    }
    salas = datos.salas || [];

    // El panel solo se muestra en las salas de ÑandutíHax: en una sala ajena la extensión
    // no pinta nada (pedido del usuario). Se revisa en cada vuelta porque los códigos de
    // las salas cambian cada vez que se reinician.
    const codigo = codigoDeLaSala();
    const enNuestraSala = esDeNandutihax(salas, codigo);
    const seVe = sePuedeVerElPanel(salas, codigo);
    enUnaSalaNuestra = seVe;
    acomodarReloj();
    panel.style.display = seVe ? "" : "none";
    marcarActiva(enNuestraSala);        // el cartel de HaxBall solo se toca en las nuestras
    if (!seVe) return;

    if (!sala || !salas.some((s) => s.clave === sala)) {
      // La primera vez, la que tenga más gente
      const conGente = salas.slice().sort((a, b) => b.cuantos - a.cuantos)[0];
      sala = conGente ? conGente.clave : null;
    }
    // Si no cambió nada, no se toca el DOM: rehacer el panel cada 4 segundos genera basura
    // para el recolector y hace trabajar al navegador sin motivo.
    const firma = JSON.stringify(salas) + "|" + sala;
    if (firma === ultimaFirma) return;
    ultimaFirma = firma;

    pintarSalas();
    pintarSala();
  }

  // El reloj se acomoda solo: rápido mientras se está mirando el panel en una sala nuestra,
  // lento si no es nuestra, y quieto con la pestaña oculta (ahí no hay nada que mirar).
  let cadaCuanto = 0;
  const acomodarReloj = () => {
    const nuevo = enUnaSalaNuestra ? CADA : CADA_LENTO;
    if (nuevo === cadaCuanto) return;
    cadaCuanto = nuevo;
    clearInterval(reloj);
    reloj = setInterval(() => { if (!document.hidden) refrescar(); }, cadaCuanto);
  };

  refrescar();
  acomodarReloj();
  // Al volver a la pestaña se refresca en el acto, así no se ve un marcador viejo
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
  window.addEventListener("beforeunload", () => clearInterval(reloj));
}

// =============================================================================
// EL CARTEL DE GOL, ARRIBA DE LA CANCHA
//
// Cuando alguien convierte, HaxBall dibuja "Blue Scores!" en el medio de la pantalla. Eso
// está pintado adentro del lienzo, así que no se puede editar… pero sí TAPAR: esto pone
// encima el cartel que el goleador compró en la tienda, que el host ya manda al chat.
//
// Dos cosas hicieron que esto sea posible, y las dos se comprobaron entrando a una sala:
//   · el chat de HaxBall SÍ es HTML (<p class="announcement" style="color:…">), así que se
//     lee el cartel tal cual, con su color;
//   · el marcador de arriba también es HTML ([data-hook="red-score"] / "blue-score"), así
//     que el gol se detecta en el acto, sin preguntarle nada a ningún servidor.
//
// El juego vive adentro del iframe game.html, por eso esta parte corre AHÍ y no en la
// ventana de arriba (donde va el panel del costado).
// =============================================================================
// =============================================================================
// SACARLE A HAXBALL SU "BLUE SCORES!" (no taparlo: que no se dibuje)
//
// En game-min.js, esos carteles son una clase que pre-dibuja CADA PALABRA, una sola vez,
// en un lienzo suelto que nunca entra en la página:
//
//   bq(palabra, color){ let c = document.createElement("canvas"), d = c.getContext("2d");
//     d.font = "900 70px 'Arial Black',…";  c.width = …;  c.height = 90;
//     d.fillText(palabra, 7, 52);           // la sombra negra
//     d.fillStyle = color; d.fillText(palabra, 0, 45);   // la letra de color
//     return c; }                            // después se pega con drawImage
//
// O sea que alcanza con no dejar pasar esos dos fillText: la textura queda transparente y
// el cartel no aparece más. Así se saca de verdad, en vez de superponerle algo encima.
//
// Se toca SOLO esa combinación —lienzo fuera de la página, 90 px de alto, letra de 70 px y
// una de las tres palabras del cartel del gol—, así que no afecta a nada más: los nombres
// de los jugadores se dibujan en el lienzo del juego (que sí está en la página) y con otra
// letra. "Time is Up!" y "Game Paused" usan palabras distintas y siguen saliendo igual.
//
// Tiene que correr ANTES que el juego (@run-at document-start), porque las texturas se
// arman una sola vez.
//
// EL PARCHE VA INYECTADO EN LA PÁGINA, no en el userscript. Los gestores de userscripts
// corren el código en un mundo aparte, con SUS PROPIOS prototipos: parchear ahí el
// CanvasRenderingContext2D no cambia nada para el juego, y eso es exactamente lo que pasó
// en la primera versión (el cartel seguía saliendo). Como haxball.com no manda ninguna
// CSP, se le puede meter un <script> a la página y ahí sí el parche queda del lado bueno.
// unsafeWindow queda como respaldo, por si algún día no se pudiera inyectar.
// =============================================================================

// Ojo: esta función se convierte a texto y se ejecuta adentro de la página, así que tiene
// que bastarse sola (nada de variables de afuera).
function parcheDelLienzo(W) {
  W = W || window;
  // Las palabras de los dos cartelones que reemplazamos: el del gol ("Red"/"Blue" +
  // "Scores!"), el del final por goles ("Red is"/"Blue is" + "Victorious!") y el del reloj
  // ("Time is" + "Up!"). "Game Paused" NO se toca: ese sigue saliendo como siempre.
  var PALABRAS = {
    Red: 1, Blue: 1, "Scores!": 1,            // el cartelón del gol
    "Red is": 1, "Blue is": 1, "Victorious!": 1,  // el del final por goles
    "Time is": 1, "Up!": 1,                   // el de "se acabó el tiempo"
  };
  var proto = W.CanvasRenderingContext2D && W.CanvasRenderingContext2D.prototype;
  if (!proto || proto.__nhSinCartel) return;

  // Deja constancia en el propio HTML, que es lo único que se ve desde los dos mundos:
  // así el panel puede mostrar si esto quedó puesto y cuántas veces frenó el cartel.
  var anotar = function (clave, valor) {
    try { W.document.documentElement.setAttribute(clave, valor); } catch (e) {}
  };

  // 1. Que las palabras del cartel no se dibujen. Alcanza con mirar que el lienzo NO esté en
  //    la página: los carteles se pre-dibujan en lienzos sueltos, mientras que los nombres de
  //    los jugadores se pintan en el lienzo del juego, que sí está en la página.
  // ¿Estamos en una sala de ÑandutíHax? La respuesta llega después (hay que preguntarle a la
  // API) y puede cambiar sin recargar, así que se relee… pero NO en cada dibujo: se guarda
  // medio segundo. Leer un atributo del DOM 60 veces por segundo se nota.
  var loQueSabemos = false;
  var cuandoLoMiramos = 0;
  var activa = function () {
    var ahora = Date.now();
    if (ahora - cuandoLoMiramos > 500) {
      cuandoLoMiramos = ahora;
      try { loQueSabemos = W.document.documentElement.getAttribute("data-nh-activo") === "si"; }
      catch (e) { loQueSabemos = false; }
    }
    return loQueSabemos;
  };

  // OJO CON EL COSTO: esto se llama por CADA texto que dibuja el juego (los nombres de los
  // jugadores, en cada cuadro). Por eso lo primero es la comparación más barata que hay —
  // buscar la palabra en un objeto— y recién después se toca el DOM. Antes se hacía
  // String(texto) y se leía canvas.isConnected siempre, y eso solo costaba 484 ms cada
  // 60.000 dibujos.
  var fill = proto.fillText;
  proto.fillText = function (texto) {
    if (typeof texto === "string" && PALABRAS[texto] === 1) {
      try {
        var lienzo = this.canvas;
        if (lienzo && !lienzo.isConnected) {
          lienzo.__nhCartel = true;             // queda marcado para el paso 2
          if (activa()) {
            W.__nhBloqueos = (W.__nhBloqueos || 0) + 1;
            anotar("data-nh-bloqueos", String(W.__nhBloqueos));
            return;
          }
        }
      } catch (e) { /* ante la duda, se dibuja como siempre */ }
    }
    return fill.apply(this, arguments);
  };

  // 2. Y por si alguna quedó dibujada antes de que llegáramos: tampoco se pega en la cancha
  var pegar = proto.drawImage;
  proto.drawImage = function (origen) {
    try { if (origen && origen.__nhCartel && activa()) return; } catch (e) {}
    return pegar.apply(this, arguments);
  };

  proto.__nhSinCartel = true;
  W.__nhCartelSacado = true;

  // La marca se vuelve a poner cuando el documento termina de armarse: si el parche entra
  // muy temprano, el <html> que la tenía después se reemplaza y la marca se pierde (y el
  // panel decía "sigue puesto" cuando en realidad estaba andando).
  anotar("data-nh-cartel", "puesto");
  try {
    W.document.addEventListener("DOMContentLoaded", function () { anotar("data-nh-cartel", "puesto"); });
    W.setTimeout(function () { anotar("data-nh-cartel", "puesto"); }, 1500);
    W.setTimeout(function () { anotar("data-nh-cartel", "puesto"); }, 5000);
  } catch (e) {}
}

function sacarElCartelDeHaxball() {
  const codigo = "(" + parcheDelLienzo.toString() + ")(window);";

  // 1. Lo de siempre: un <script> propio, que la página ejecuta como si fuera suyo
  const meterEnLaPagina = () => {
    const destino = document.head || document.documentElement;
    if (!destino) return false;
    const etiqueta = document.createElement("script");
    etiqueta.textContent = codigo;
    destino.appendChild(etiqueta);
    etiqueta.remove();                // ya corrió: no hace falta dejarlo en el DOM
    return true;
  };

  if (!meterEnLaPagina()) {
    // Todavía no existe ni el <html> (pasa con document-start): lo metemos apenas aparezca
    const ojo = new MutationObserver(() => { if (meterEnLaPagina()) ojo.disconnect(); });
    ojo.observe(document, { childList: true, subtree: true });
  }

  // 2. Respaldo: el mundo del userscript. Si resulta ser el mismo de la página, no hace
  //    nada (el parche de arriba ya dejó la marca puesta).
  try {
    const W = (typeof unsafeWindow !== "undefined" && unsafeWindow) || window;
    if (W.CanvasRenderingContext2D && !W.CanvasRenderingContext2D.prototype.__nhSinCartel) {
      parcheDelLienzo(W);
    }
  } catch (e) { /* si el gestor no deja, ya está el <script> inyectado */ }

  return true;
}

function arrancarCartelDeGol() {
  "use strict";

  const MARCA = MARCAS.gol;               // marca invisible del cartel de GOL
  const MARCA_INICIO = MARCAS.inicio;     // …la del cartel de INICIO (el saque)
  const MARCA_VICTORIA = MARCAS.victoria; // …la del cartel de VICTORIA (el final por goles)
  const MARCA_TIEMPO = MARCAS.tiempo;     // …y la del "se acabó el tiempo"
  const DURA = 3200;              // cuánto se queda en pantalla
  const ESPERA = 900;             // cuánto se le da al cartel del host antes de usar el nuestro

  let capa = null, reloj = null, porLasDudas = null, rojo = null, azul = null, observando = null;

  const estilo = document.createElement("style");
  estilo.textContent = `
    #nh-gol {
      position: fixed; z-index: 2147483647; pointer-events: none;
      display: flex; align-items: center; justify-content: center; text-align: center;
      font-family: Inter, system-ui, "Segoe UI", sans-serif; font-weight: 800;
      background: linear-gradient(180deg, rgba(8,12,16,0) 0%, rgba(8,12,16,.5) 18%, rgba(8,12,16,.5) 82%, rgba(8,12,16,0) 100%);
      opacity: 0; transition: opacity .18s ease;
    }
    #nh-gol.viendose { opacity: 1; }
    #nh-gol .texto {
      padding: 0 16px; line-height: 1.25; text-shadow: 0 3px 14px rgba(0,0,0,.85);
      transform: scale(.86); transition: transform .28s cubic-bezier(.2,1.5,.4,1);
    }
    #nh-gol.viendose .texto { transform: scale(1); }
    #nh-gol .nh-palabra { white-space: nowrap; }
  `;

  const armarCapa = () => {
    if (capa && capa.isConnected) return capa;
    capa = document.createElement("div");
    capa.id = "nh-gol";
    capa.innerHTML = '<div class="texto"></div>';
    if (!estilo.isConnected) (document.head || document.documentElement).appendChild(estilo);
    document.body.appendChild(capa);
    return capa;
  };

  // Un color por letra, igual que InicioModel.coloresDeCadaLetra() del lado de la web: si
  // hay menos colores que letras, las que sobran usan el último.
  const coloresPorLetra = (texto, inicio) => {
    const lista = (inicio && inicio.colores) || [];
    if (!lista.length) return null;
    const base = (inicio && inicio.color) || "FFD700";
    const salida = [];
    for (let i = 0; i < texto.length; i++) salida.push(lista[i] || lista[lista.length - 1] || base);
    return salida;
  };

  // Se acomoda sobre el lienzo, justo donde HaxBall escribe su "Scores!"
  const mostrar = (texto, color, tamano, colores) => {
    const lienzo = document.querySelector(".game-state-view canvas");
    if (!lienzo || !texto) return;
    const r = lienzo.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;

    const c = armarCapa();
    c.style.left = r.left + "px";
    c.style.top = (r.top + r.height * 0.28) + "px";
    c.style.width = r.width + "px";
    c.style.height = Math.max(90, r.height * 0.34) + "px";

    const dentro = c.querySelector(".texto");
    dentro.style.fontSize = Math.max(16, Math.min(40, (tamano || 1) * r.width / 26)) + "px";

    // Con colores por letra se arma letra por letra, PERO agrupando por palabra: con un
    // <span> por letra suelto, el navegador corta el renglón en cualquier lado (quedaba
    // "OLIMPI / A"). Y se cuenta con [...texto] porque un emoji ocupa dos caracteres.
    if (colores && colores.length) {
      dentro.textContent = "";
      const deColor = (i) => "#" + String(colores[i] || colores[colores.length - 1]).replace(/^#/, "");
      let i = 0;
      texto.split(" ").forEach((palabra, n) => {
        if (n > 0) { dentro.appendChild(document.createTextNode(" ")); i++; }
        const grupo = document.createElement("span");
        grupo.className = "nh-palabra";

        // Las letras seguidas DEL MISMO COLOR van en un solo elemento: se ve igual y pesa
        // mucho menos (un cartel de un color pasa de 40 elementos a uno)
        let tramo = null, colorDelTramo = null;
        for (const letra of palabra) {
          const suyo = deColor(i);
          if (suyo !== colorDelTramo) {
            tramo = document.createElement("span");
            tramo.style.color = suyo;
            grupo.appendChild(tramo);
            colorDelTramo = suyo;
          }
          tramo.textContent += letra;
          i++;
        }
        dentro.appendChild(grupo);
      });
    } else {
      dentro.textContent = texto;
      dentro.style.color = color || "#ffffff";
    }

    void c.offsetWidth;                      // para que la animación arranque de nuevo
    c.classList.add("viendose");
    clearTimeout(reloj);
    reloj = setTimeout(() => c.classList.remove("viendose"), DURA);
  };

  // El cartel del host: un <p class="announcement"> con la marca invisible al final
  const mirarElChat = (log) => {
    const ojo = new MutationObserver((cambios) => {
      cambios.forEach((c) => c.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const texto = n.textContent || "";

        // Un aviso firmado por el host es la prueba de que esta sala es nuestra, aunque la
        // dirección no tenga ningún ?c= (se entró desde la lista de salas de HaxBall).
        if (esUnAvisoNuestro(texto)) confirmarSalaNuestra();
        if (!loNuestro.nuestra) return;

        // El cartel del ARRANQUE: el host lo marca distinto y acá se pinta con los colores
        // por letra que se cargaron en el panel (el chat solo puede con un color).
        if (texto.indexOf(MARCA_INICIO) >= 0) {
          clearTimeout(porLasDudas);
          const limpio = texto.split(MARCA_INICIO).join("").trim();
          const inicio = loNuestro.inicio || {};
          mostrar(limpio, n.style && n.style.color, 1, coloresPorLetra(limpio, inicio));
          return;
        }

        // Los del FINAL: por goles ("Red is Victorious!") o por reloj ("Time is Up!")
        for (const [marca, cual] of [[MARCA_VICTORIA, "victoria"], [MARCA_TIEMPO, "tiempo"]]) {
          if (texto.indexOf(marca) < 0) continue;
          clearTimeout(porLasDudas);
          const limpio = texto.split(marca).join("").trim();
          mostrar(limpio, n.style && n.style.color, 1.1, coloresPorLetra(limpio, loNuestro[cual] || {}));
          return;
        }

        if (texto.indexOf(MARCA) < 0) return;
        clearTimeout(porLasDudas);
        const color = n.style && n.style.color;
        mostrar(texto.split(MARCA).join("").trim(), color, 1);
      }));
    });
    ojo.observe(log, { childList: true });
    return ojo;
  };

  // El marcador del propio juego: cambia en el instante del gol, sin pasar por ningún servidor
  const mirarElMarcador = (r, a) => {
    const numero = (e) => Number(String(e.textContent || "").trim()) || 0;
    let rojo = numero(r), azul = numero(a);
    const ojo = new MutationObserver(() => {
      const rojoAhora = numero(r), azulAhora = numero(a);
      if (rojoAhora === rojo && azulAhora === azul) return;

      const subioElRojo = rojoAhora > rojo;
      const subioElAzul = azulAhora > azul;
      rojo = rojoAhora;
      azul = azulAhora;

      // GOL es solo cuando el marcador SUBE. Al empezar el partido vuelve a 0-0 (o se pone
      // en 0 por primera vez) y eso también mueve estos números: antes salía un "¡GOL! 0 - 0"
      // en el saque inicial.
      clearTimeout(porLasDudas);
      if (!subioElRojo && !subioElAzul) return;
      if (!loNuestro.nuestra) return;        // sala ajena: la extensión no se mete

      // Si el host manda un cartel comprado, gana ese; si no, a los 900 ms va el nuestro
      porLasDudas = setTimeout(() => {
        mostrar("¡GOL!   " + rojoAhora + " - " + azulAhora, subioElRojo ? "#e56e56" : "#5689e5", 1.1);
      }, ESPERA);
    });
    ojo.observe(r, { childList: true, characterData: true, subtree: true });
    ojo.observe(a, { childList: true, characterData: true, subtree: true });
    return ojo;
  };

  // HaxBall rehace su pantalla al entrar y al salir de una sala, así que se revisa seguido
  setInterval(() => {
    const log = document.querySelector('[data-hook="log-contents"]');
    const r = document.querySelector('[data-hook="red-score"]');
    const a = document.querySelector('[data-hook="blue-score"]');
    if (!log || !r || !a) return;
    if (log === observando && r === rojo && a === azul) return;
    if (observando) olvidarLaSala();       // era otra pantalla: se vuelve a empezar
    observando = log; rojo = r; azul = a;
    mirarElChat(log);
    mirarElMarcador(r, a);
    console.log("[NandutiHax] cartel de gol enganchado");
  }, 1500);
}

// =============================================================================
// MOSTRAR/OCULTAR LA BARRA DE CHAT DE HAXBALL, EN EL CELULAR
//
// `.chatbox-view` (la caja del chat, de HaxBall, no nuestra) trae 160px de alto de fábrica y
// tapa justo donde va nuestro joystick: se ve todo amontonado (visto con Puppeteer, emulando
// un iPhone). En vez de achicarla, un botón fijo —igual que el del joystick— la esconde y la
// vuelve a mostrar cuando se quiera. Se guarda en localStorage aparte del joystick, así se
// pueden ocultar por separado.
//
// Ocultarla esconde TODA la caja (el registro de mensajes y el cuadro para escribir), así
// que mientras está oculta no se puede escribir en el chat — es la idea: es para el que
// quiere la cancha despejada un rato y vuelve a mostrarla para hablar.
function arrancarAlternarChat() {
  if (!esTactil()) return;
  const LLAVE = "nandutihax_chat";
  const estaOculto = () => { try { return localStorage.getItem(LLAVE) === "oculto"; } catch (e) { return false; } };

  const estilo = document.createElement("style");
  estilo.textContent = `
    #nh-alternar-chat {
      position: fixed; top: max(54px, calc(env(safe-area-inset-top) + 54px)); left: 58px;
      z-index: 2147483001; width: 38px; height: 38px; border-radius: 50%; pointer-events: auto;
      background: rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.35); color: #fff;
      font-size: 17px; display: flex; align-items: center; justify-content: center;
      -webkit-user-select: none; user-select: none; touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }
    #nh-alternar-chat.apagado { opacity: .45; border-color: rgba(255,255,255,.18); }
  `;
  document.head.appendChild(estilo);

  const boton = document.createElement("button");
  boton.id = "nh-alternar-chat";
  boton.type = "button";
  boton.textContent = "💬";
  document.body.appendChild(boton);

  const pintar = (oculto) => {
    boton.classList.toggle("apagado", oculto);
    boton.title = oculto ? "Mostrar el chat" : "Ocultar el chat";
    try {
      const caja = document.querySelector(".chatbox-view");
      if (caja) caja.style.display = oculto ? "none" : "";
    } catch (e) {}
  };

  // touchstart (con preventDefault) es lo normal; "click" queda de respaldo para el que
  // toca con un mouse o trackpad (algunos iPad) o si el touch, por lo que sea, no le llega.
  // La marca de tiempo evita que un click fantasma después del touch lo alterne dos veces.
  let ultimoUso = 0;
  const alternar = () => {
    ultimoUso = Date.now();
    const nuevo = !estaOculto();
    try { localStorage.setItem(LLAVE, nuevo ? "oculto" : "visible"); } catch (e) {}
    pintar(nuevo);
  };
  boton.addEventListener("touchstart", (ev) => { ev.preventDefault(); alternar(); }, { passive: false });
  boton.addEventListener("click", () => { if (Date.now() - ultimoUso > 600) alternar(); });

  // La caja del chat la arma HaxBall recién al entrar a una sala (no está en la pantalla de
  // elegir nick) y la rehace en cada sala distinta: hay que volver a pintar el estado cada
  // vez que aparece una caja nueva, y volver a poner el botón si HaxBall rehizo la pantalla.
  setInterval(() => {
    if (!boton.isConnected) document.body.appendChild(boton);
    pintar(estaOculto());
  }, 1500);
}

// =============================================================================
// CONTROLES TÁCTILES (joystick + patada) — para jugar desde el celular
//
// HaxBall escucha "keydown"/"keyup" en document con event.code: ArrowUp/KeyW = arriba,
// ArrowDown/KeyS = abajo, ArrowLeft/KeyA = izquierda, ArrowRight/KeyD = derecha, y
// KeyX/Space/Control/Shift = patear (visto en game-min.js, la clase que junta esos toques
// en un Set y arma el input con banderas: Up=1, Down=2, Left=4, Right=8, Kick=16). No hay
// ningún control por API para el jugador propio (room.setPlayerInput es del host, no del
// jugador), así que se dispara un KeyboardEvent sintético con el código justo, tal cual
// llegaría de un teclado de verdad. Probado contra una sala en vivo: mueve al jugador.
//
// Solo aparece en un dispositivo con pantalla táctil (no le agrega nada a quien ya tiene
// teclado) y solo adentro de una sala de ÑandutíHax (mismo "data-nh-activo" que usa el
// parche del lienzo).
//
// SE OCULTA Y SE VUELVE A MOSTRAR desde DOS lados, y los dos escriben la MISMA llave de
// localStorage ("nandutihax_joystick"): el botón fijo de la esquina (acá, adentro del
// juego) y el interruptor del panel de ÑandutíHax (arrancarNandutiHax(), en la ventana de
// arriba). Panel e iframe son el mismo origen (www.haxball.com), así que localStorage ya
// se comparte solo entre los dos — no hace falta ningún mensaje entre ventanas. Por eso acá
// también se relee cada 1 s: para enterarse si lo apagaron desde el panel.
//
// ANTES el único botón para ocultarlo era uno de texto pegado abajo, adentro del propio
// joystick: al tocarlo, TODO el grupo (joystick + patear + el botón mismo) se escondía de
// una, y no quedaba nada en pantalla para volver a mostrarlo — había que borrar
// localStorage a mano. Por eso el botón de alternar ahora es un elemento APARTE, fijo en
// una esquina, que nunca se esconde.
function arrancarJoystick() {
  if (!esTactil()) return;

  const LLAVE = "nandutihax_joystick";
  const estaOculto = () => { try { return localStorage.getItem(LLAVE) === "oculto"; } catch (e) { return false; } };
  const guardarOculto = (si) => { try { localStorage.setItem(LLAVE, si ? "oculto" : "visible"); } catch (e) {} };

  const disparar = (tipo, code) => {
    try { document.dispatchEvent(new KeyboardEvent(tipo, { code, bubbles: true, cancelable: true })); }
    catch (e) {}
  };

  const estilo = document.createElement("style");
  estilo.textContent = `
    #nh-controles { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
    #nh-controles.oculto { display: none; }
    #nh-joystick, #nh-patear {
      position: absolute; bottom: max(18px, env(safe-area-inset-bottom)); pointer-events: auto;
      touch-action: none; -webkit-user-select: none; user-select: none;
    }
    #nh-joystick {
      left: max(18px, env(safe-area-inset-left)); width: 122px; height: 122px; border-radius: 50%;
      background: rgba(255,255,255,.14); border: 2px solid rgba(255,255,255,.35);
    }
    #nh-joystick .nh-palito {
      position: absolute; width: 54px; height: 54px; border-radius: 50%; left: 50%; top: 50%;
      transform: translate(-50%, -50%); background: rgba(255,255,255,.5); border: 2px solid rgba(255,255,255,.7);
      transition: background .1s;
    }
    #nh-joystick.activo .nh-palito { background: rgba(255,255,255,.85); }
    #nh-patear {
      right: max(22px, env(safe-area-inset-right)); width: 92px; height: 92px; border-radius: 50%;
      background: rgba(229,110,86,.5); border: 2px solid rgba(229,110,86,.8);
      display: flex; align-items: center; justify-content: center; font-size: 34px;
      transition: background .1s, transform .1s;
    }
    #nh-patear.activo { background: rgba(229,110,86,.85); transform: scale(.94); }
    /* Fijo en la esquina, SIEMPRE visible (no es hijo de #nh-controles): con el joystick
       oculto es la única forma de volver a mostrarlo. */
    #nh-alternar-joystick {
      position: fixed; top: max(54px, calc(env(safe-area-inset-top) + 54px)); left: 10px;
      z-index: 2147483001; width: 38px; height: 38px; border-radius: 50%; pointer-events: auto;
      background: rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.35); color: #fff;
      font-size: 17px; display: flex; align-items: center; justify-content: center;
      -webkit-user-select: none; user-select: none; touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }
    #nh-alternar-joystick.apagado { opacity: .45; border-color: rgba(255,255,255,.18); }
  `;
  document.head.appendChild(estilo);

  const capa = document.createElement("div");
  capa.id = "nh-controles";
  capa.innerHTML = `
    <div id="nh-joystick"><div class="nh-palito"></div></div>
    <div id="nh-patear">⚽</div>
  `;
  const alternar = document.createElement("button");
  alternar.id = "nh-alternar-joystick";
  alternar.type = "button";
  alternar.textContent = "🕹️";

  const pintarAlternar = (oculto) => {
    alternar.classList.toggle("apagado", oculto);
    alternar.title = oculto ? "Mostrar el joystick" : "Ocultar el joystick";
  };

  // Lo que cambia el estado, sea desde este botón o desde el panel: guarda, pinta las dos
  // partes y —si se acaba de ocultar— suelta lo que estuviera apretado, para no dejar una
  // dirección clavada. Definida acá arriba (se llama recién más abajo, una vez que
  // soltarJoystick/soltarPatada ya existen).
  let soltarTodo = () => {};   // se reemplaza más abajo; placeholder por si se llama antes
  const aplicarOculto = (oculto) => {
    capa.classList.toggle("oculto", oculto);
    pintarAlternar(oculto);
    if (oculto) soltarTodo();
  };

  document.body.appendChild(capa);
  document.body.appendChild(alternar);

  // touchstart (con preventDefault) es lo normal; "click" queda de respaldo para el que
  // toca con un mouse o trackpad (algunos iPad) o si el touch, por lo que sea, no le llega.
  // La marca de tiempo evita que un click fantasma después del touch lo alterne dos veces.
  let ultimoUsoAlternar = 0;
  const usarAlternar = () => {
    ultimoUsoAlternar = Date.now();
    const nuevo = !estaOculto();
    guardarOculto(nuevo);
    aplicarOculto(nuevo);
  };
  alternar.addEventListener("touchstart", (ev) => { ev.preventDefault(); usarAlternar(); }, { passive: false });
  alternar.addEventListener("click", () => { if (Date.now() - ultimoUsoAlternar > 600) usarAlternar(); });

  const base = capa.querySelector("#nh-joystick");
  const palito = capa.querySelector(".nh-palito");
  const RADIO = 40;          // hasta dónde se puede mover el palito (px)
  const ZONA_MUERTA = 14;    // por debajo de esto no se manda ninguna dirección

  // Direcciones activas del joystick (Up/Down/Left/Right). El de patear va aparte.
  let activas = new Set();
  let dedoJoystick = null;

  const aplicarDirecciones = (dx, dy) => {
    const quiero = new Set();
    if (dy < -ZONA_MUERTA) quiero.add("ArrowUp");
    if (dy > ZONA_MUERTA) quiero.add("ArrowDown");
    if (dx < -ZONA_MUERTA) quiero.add("ArrowLeft");
    if (dx > ZONA_MUERTA) quiero.add("ArrowRight");
    for (const code of quiero) if (!activas.has(code)) disparar("keydown", code);
    for (const code of activas) if (!quiero.has(code)) disparar("keyup", code);
    activas = quiero;
    base.classList.toggle("activo", quiero.size > 0);
  };

  const soltarJoystick = () => {
    dedoJoystick = null;
    for (const code of activas) disparar("keyup", code);
    activas = new Set();
    base.classList.remove("activo");
    palito.style.transform = "translate(-50%, -50%)";
  };

  base.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    dedoJoystick = ev.changedTouches[0].identifier;
  }, { passive: false });

  document.addEventListener("touchmove", (ev) => {
    if (dedoJoystick === null) return;
    const toque = [...ev.changedTouches].find((t) => t.identifier === dedoJoystick);
    if (!toque) return;
    ev.preventDefault();
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = toque.clientX - cx, dy = toque.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const recorte = Math.min(1, RADIO / d);
    palito.style.transform = `translate(${dx * recorte - 27}px, ${dy * recorte - 27}px)`;
    aplicarDirecciones(dx, dy);
  }, { passive: false });

  const finDeToque = (ev) => {
    if (dedoJoystick === null) return;
    if (![...ev.changedTouches].some((t) => t.identifier === dedoJoystick)) return;
    soltarJoystick();
  };
  document.addEventListener("touchend", finDeToque);
  document.addEventListener("touchcancel", finDeToque);

  // El botón de patear: aparte, con su propio dedo (se puede correr y patear a la vez)
  const boton = capa.querySelector("#nh-patear");
  let dedoPatada = null;
  boton.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    dedoPatada = ev.changedTouches[0].identifier;
    boton.classList.add("activo");
    disparar("keydown", "Space");
  }, { passive: false });
  const soltarPatada = (ev) => {
    if (dedoPatada === null) return;
    if (ev && ![...ev.changedTouches].some((t) => t.identifier === dedoPatada)) return;
    dedoPatada = null;
    boton.classList.remove("activo");
    disparar("keyup", "Space");
  };
  document.addEventListener("touchend", soltarPatada);
  document.addEventListener("touchcancel", soltarPatada);

  // Ahora sí, con soltarJoystick/soltarPatada ya definidas: se reemplaza el placeholder y
  // recién acá se pinta el estado inicial (leído de localStorage).
  soltarTodo = () => { soltarJoystick(); soltarPatada(); };
  aplicarOculto(estaOculto());

  // Si HaxBall rehace la pantalla (se entra o se sale de una sala), los controles quedan
  // colgados de un <body> que ya no está: se los vuelve a poner igual que el cartel de gol.
  const reponer = () => {
    if (!capa.isConnected) document.body.appendChild(capa);
    if (!alternar.isConnected) document.body.appendChild(alternar);
  };
  setInterval(reponer, 1500);

  // Solo se muestra adentro de una sala de ÑandutíHax: la misma marca que usa el parche del
  // lienzo para el cartel de gol ("data-nh-activo"), leída acá cada 1 s. Y de paso, en esa
  // misma vuelta, se relee si lo ocultaron o lo volvieron a mostrar desde el panel (que
  // corre en la ventana de arriba y escribe la MISMA llave de localStorage).
  let ocultoVisto = estaOculto();
  const revisarSiEsNuestra = () => {
    let esNuestra = false;
    try { esNuestra = document.documentElement.getAttribute("data-nh-activo") === "si"; } catch (e) {}
    alternar.style.visibility = esNuestra ? "" : "hidden";
    capa.style.visibility = esNuestra ? "" : "hidden";
    if (!esNuestra) { soltarTodo(); return; }

    const oculto = estaOculto();
    if (oculto !== ocultoVisto) { ocultoVisto = oculto; aplicarOculto(oculto); }
  };
  revisarSiEsNuestra();
  setInterval(revisarSiEsNuestra, 1000);

  console.log("[NandutiHax] controles táctiles listos (joystick + patear)");
}

// =============================================================================
// EN NUESTRA WEB: solo decirle qué versión está instalada
//
// El script también corre en nandutihax.com, pero ahí no dibuja nada: deja la versión en el
// <html> para que la página de la extensión pueda decir "tenés la 1.4.0, está al día" o
// "estás desactualizado". Es la forma de saberlo sin pedirle a nadie que abra la consola.
// =============================================================================
function avisarLaVersionEnLaWeb() {
  const dejarla = () => {
    try { document.documentElement.setAttribute("data-nandutihax", VERSION_INSTALADA); } catch (e) {}
  };
  dejarla();
  document.addEventListener("DOMContentLoaded", dejarla, { once: true });
  setTimeout(dejarla, 1200);
}

// =============================================================================
// EL ANCHO DEL JUEGO EN EL CELULAR — la propia página de HaxBall (no la nuestra) reserva
// una franja fija de anuncio (`.rightbar`, ~160px, de la red "cpmstar") al lado del juego
// (`.gameframe`), y esa franja NO se achica en una pantalla angosta. En un celular eso deja
// el juego comprimido en una tira de apenas ~230px, y nuestro panel —pensado para
// desktop— no entraba ahí: se veía todo amontonado y superpuesto (reportado con una
// captura de un iPhone).
//
// Se saca esa franja SOLO en un dispositivo táctil: en desktop se deja tal cual, porque ahí
// sí entra cómodo y no hace falta tocar nada de la página del autor. Al esconder
// `.rightbar`, el contenedor de al lado (`.flexCol.flexGrow`, que ya tiene flex-grow en un
// `display:flex`) pasa a ocupar todo el ancho que queda libre, sin que haga falta
// calcularlo a mano.
//
// `.rightbar`/`.gameframe` son clases sueltas de la página del autor (no hay ningún
// `data-hook` acá, a diferencia de adentro del juego): pueden cambiar el día que rehagan la
// página. Por eso es un `<style>` con el selector nada más: si esas clases desaparecen, la
// regla simplemente no encuentra nada y no rompe nada.
function arreglarAnunciosEnElCelular() {
  if (!esTactil()) return;
  try {
    const estilo = document.createElement("style");
    estilo.textContent = `
      .rightbar { display: none !important; }
      .gameframe { width: 100% !important; }
    `;
    (document.head || document.documentElement).appendChild(estilo);
  } catch (e) {}
}

// Ojo: según el gestor de userscripts, esto puede correr ANTES de que exista el <html>
// (document-start). Ahí `document.documentElement` es null y el panel no se dibujaba nunca:
// tiraba "Cannot read properties of null (reading 'appendChild')" y el script moría en silencio.
function arrancarTodo() {
  if (esNuestraWeb()) return avisarLaVersionEnLaWeb();
  // El panel del costado va en la ventana de arriba; el cartel de gol y los controles
  // táctiles, adentro del juego
  if (window.top === window.self) { arreglarAnunciosEnElCelular(); arrancarNandutiHax(); }
  else { arrancarCartelDeGol(); arrancarJoystick(); arrancarAlternarChat(); }
}

// El parche del lienzo NO toca el DOM y tiene que ser lo primero de todo, antes de que el
// juego arme sus texturas: por eso va suelto acá y no adentro de arrancarTodo(). Queda en
// espera (`data-nh-activo`) hasta que se confirme que la sala es de ÑandutíHax.
if (!esNuestraWeb() && window.top !== window.self) {
  sacarElCartelDeHaxball();
  vigilarSiEsSalaNuestra();
}

if (document.body) arrancarTodo();
else document.addEventListener("DOMContentLoaded", arrancarTodo, { once: true });
