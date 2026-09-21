// ==UserScript==
// @name         ÑandutíHax
// @namespace    https://nandutihax.com/
// @version      1.0.0
// @description  Un panel de ÑandutíHax arriba del juego: el marcador, quién está en cancha y el ELO de cada uno, en vivo.
// @author       Jinder
// @icon         https://nandutihax.com/img/logo-chico.png
// @match        https://*.haxball.com/*
// @connect      nandutihax.com
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @downloadURL  https://nandutihax.com/nandutihax.user.js
// @updateURL    https://nandutihax.com/nandutihax.user.js
// ==/UserScript==

// =============================================================================
// QUÉ HACE Y QUÉ NO
//
// El marcador que dibuja HaxBall arriba de la pantalla (los dos cuadraditos, el 0-0 y el
// reloj) está DENTRO del lienzo del juego: no es HTML y no se puede pisar con CSS. Esta
// extensión no lo toca.
//
// Lo que hace es poner AL LADO un panel propio de ÑandutíHax, que sí es HTML nuestro, con
// el marcador, quién está en cada equipo y el ELO de cada uno. Los datos salen de
// https://nandutihax.com/api/publico/salas, que devuelve solo eso.
//
// Se pide con GM_xmlhttpRequest a propósito: un fetch normal desde haxball.com choca con
// CORS. Por eso es un userscript (Tampermonkey/Violentmonkey) y no una extensión de la
// tienda de Chrome: se instala con un clic y no hay que esperar ninguna revisión.
// =============================================================================

(function () {
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
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
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
  document.documentElement.appendChild(estilo);

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
  document.documentElement.appendChild(panel);

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
})();
