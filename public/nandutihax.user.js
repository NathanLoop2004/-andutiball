// ==UserScript==
// @name         ÑandutíHax
// @namespace    https://nandutihax.com/
// @version      1.2.0
// @description  Un panel de ÑandutíHax arriba del juego: el marcador, quién está en cancha y el ELO de cada uno, en vivo.
// @author       Jinder
// @icon         https://nandutihax.com/img/logo-chico.png
// @match        https://*.haxball.com/*
// @connect      nandutihax.com
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
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
// Se pide con GM_xmlhttpRequest a propósito: un fetch normal desde haxball.com choca con
// CORS. Por eso es un userscript (Tampermonkey/Violentmonkey) y no una extensión de la
// tienda de Chrome: se instala con un clic y no hay que esperar ninguna revisión.
// =============================================================================

function arrancarNandutiHax() {
  "use strict";

  const API = "https://nandutihax.com/api/publico/salas";
  const CADA = 4000;          // cada cuánto se refresca
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

  // ── El pedido. Tampermonkey lo hace por afuera del navegador, así que no hay CORS ──
  const pedir = () => new Promise((listo) => {
    const gm = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest
      : (typeof GM !== "undefined" && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
    if (!gm) return listo(null);
    gm({
      method: "GET",
      url: API + "?t=" + Date.now(),
      timeout: 8000,
      onload: (r) => {
        try { listo(JSON.parse(r.responseText)); } catch (e) { listo(null); }
      },
      onerror: () => listo(null),
      ontimeout: () => listo(null),
    });
  });

  // ── El panel ──
  const css = `
    #nh-panel {
      position: fixed; top: 44px; right: 12px; z-index: 2147483647;
      width: 268px; font-family: Inter, system-ui, "Segoe UI", sans-serif; font-size: 13px;
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
  `;

  const estilo = document.createElement("style");
  estilo.textContent = css;
  (document.head || document.documentElement).appendChild(estilo);

  const panel = document.createElement("div");
  panel.id = "nh-panel";
  if (!abierto) panel.classList.add("cerrado");
  panel.innerHTML = `
    <div id="nh-cabeza">
      <img src="https://nandutihax.com/img/logo-chico.png" alt="">
      <b>ÑandutíHax</b>
      <button id="nh-plegar" title="Mostrar u ocultar">${abierto ? "–" : "+"}</button>
    </div>
    <div id="nh-cuerpo">
      <div id="nh-salas"></div>
      <div id="nh-contenido"><div class="nh-vacio">Buscando las salas…</div></div>
      <div id="nh-pie"><span id="nh-cuando">—</span><a href="https://nandutihax.com" target="_blank">nandutihax.com</a></div>
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
  console.log("[NandutiHax] panel listo, version 1.2.0");

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
  }

  async function refrescar() {
    montar();
    const datos = await pedir();
    if (!datos || !datos.ok) {
      $("nh-contenido").innerHTML = '<div class="nh-vacio">No se pudo hablar con ÑandutíHax.</div>';
      return;
    }
    salas = datos.salas || [];
    if (!sala || !salas.some((s) => s.clave === sala)) {
      // La primera vez, la que tenga más gente
      const conGente = salas.slice().sort((a, b) => b.cuantos - a.cuantos)[0];
      sala = conGente ? conGente.clave : null;
    }
    pintarSalas();
    pintarSala();
  }

  refrescar();
  reloj = setInterval(refrescar, CADA);
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
// letra, y los otros carteles ("Time is Up!", "Red is Victorious!", "Game Paused") usan
// palabras distintas y siguen saliendo igual.
//
// Tiene que correr ANTES que el juego (@run-at document-start), porque las texturas se
// arman una sola vez. Y sobre unsafeWindow: el gestor de userscripts corre en un mundo
// aparte, y si se parchea el prototipo de ese mundo la página no se entera.
// =============================================================================
function sacarElCartelDeHaxball() {
  const PALABRAS = { Red: 1, Blue: 1, "Scores!": 1 };
  const W = (typeof unsafeWindow !== "undefined" && unsafeWindow) || window;
  const proto = W.CanvasRenderingContext2D && W.CanvasRenderingContext2D.prototype;
  if (!proto || proto.__nhSinCartel) return false;

  const original = proto.fillText;
  proto.fillText = function (texto) {
    try {
      const lienzo = this.canvas;
      if (lienzo && !lienzo.isConnected && lienzo.height === 90 &&
          PALABRAS[String(texto)] && String(this.font).indexOf("70px") >= 0) {
        return;                       // este es el cartelón del gol: no se dibuja
      }
    } catch (e) { /* ante la duda, se dibuja como siempre */ }
    return original.apply(this, arguments);
  };
  proto.__nhSinCartel = true;
  return true;
}

function arrancarCartelDeGol() {
  "use strict";

  const MARCA = "​​";   // la marca invisible que el host le pega al cartel de gol
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
      word-break: break-word;
    }
    #nh-gol.viendose .texto { transform: scale(1); }
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

  // Se acomoda sobre el lienzo, justo donde HaxBall escribe su "Scores!"
  const mostrar = (texto, color, tamano) => {
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
    dentro.textContent = texto;
    dentro.style.color = color || "#ffffff";
    dentro.style.fontSize = Math.max(16, Math.min(40, (tamano || 1) * r.width / 26)) + "px";

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
    const leer = (e) => (e.textContent || "").trim();
    let antes = leer(r) + "-" + leer(a);
    const ojo = new MutationObserver(() => {
      const ahora = leer(r) + "-" + leer(a);
      if (ahora === antes) return;
      const subioElRojo = Number(leer(r)) > Number(antes.split("-")[0]);
      antes = ahora;
      // Si el host manda un cartel comprado, gana ese; si no, a los 900 ms va el nuestro
      clearTimeout(porLasDudas);
      porLasDudas = setTimeout(() => {
        mostrar("¡GOL!   " + leer(r) + " - " + leer(a), subioElRojo ? "#e56e56" : "#5689e5", 1.1);
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
    observando = log; rojo = r; azul = a;
    mirarElChat(log);
    mirarElMarcador(r, a);
    console.log("[NandutiHax] cartel de gol enganchado");
  }, 1500);
}

// Ojo: según el gestor de userscripts, esto puede correr ANTES de que exista el <html>
// (document-start). Ahí `document.documentElement` es null y el panel no se dibujaba nunca:
// tiraba "Cannot read properties of null (reading 'appendChild')" y el script moría en silencio.
function arrancarTodo() {
  // El panel del costado va en la ventana de arriba; el cartel de gol, adentro del juego
  if (window.top === window.self) arrancarNandutiHax();
  else arrancarCartelDeGol();
}

// Esto NO toca el DOM y tiene que ser lo primero de todo, antes de que el juego arme sus
// texturas: por eso va suelto acá y no adentro de arrancarTodo()
if (window.top !== window.self) {
  console.log("[NandutiHax] cartel de HaxBall sacado del lienzo:", sacarElCartelDeHaxball());
}

if (document.body) arrancarTodo();
else document.addEventListener("DOMContentLoaded", arrancarTodo, { once: true });
