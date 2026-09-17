// Modo claro / oscuro de Ñandutí Web.
//
// Va en el <head> de cada pantalla (sin defer), así el tema se pone ANTES de dibujar la página y
// no hay parpadeo. Si nadie eligió, se sigue al sistema. El botón se agrega solo al final de la
// barra de arriba, y lo que se elige queda guardado en este navegador.
(function () {
  var LLAVE = "nanduti_tema";
  var raiz = document.documentElement;
  var SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function guardado() {
    try { return localStorage.getItem(LLAVE); } catch (e) { return null; }
  }
  function poner(tema) {
    if (tema === "claro" || tema === "oscuro") raiz.setAttribute("data-tema", tema);
    else raiz.removeAttribute("data-tema");
  }
  function actual() {
    var t = raiz.getAttribute("data-tema");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  }
  function pintarBotones() {
    var oscuro = actual() === "oscuro";
    document.querySelectorAll(".tema-boton").forEach(function (b) {
      b.innerHTML = oscuro ? SOL : LUNA;
      b.title = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
      b.setAttribute("aria-label", b.title);
    });
  }

  poner(guardado());

  window.Tema = {
    actual: actual,
    alternar: function () {
      var nuevo = actual() === "oscuro" ? "claro" : "oscuro";
      try { localStorage.setItem(LLAVE, nuevo); } catch (e) {}
      poner(nuevo);
      pintarBotones();
    },
  };

  function agregarBotones() {
    document.querySelectorAll(".barra").forEach(function (barra) {
      if (barra.querySelector(".tema-boton")) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tema-boton";
      b.onclick = window.Tema.alternar;
      barra.appendChild(b);
    });
    pintarBotones();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", agregarBotones);
  else agregarBotones();

  // Si cambia el tema del sistema y nadie eligió uno, se actualiza el ícono
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", pintarBotones);
  }
})();
