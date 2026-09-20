// =============================================================================
// anuncios.js — la publicidad de la portada
//
// Los espacios se escriben en el HTML como <div class="anuncio" data-anuncio="portada-arriba">
// y quedan VACÍOS Y OCULTOS hasta que este archivo confirma que hay que mostrarlos. Así, con los
// anuncios apagados, la página no carga nada de Google: ni un pedido, ni una cookie.
//
// El interruptor y el identificador salen de GET /api/ajustes/publicos:
//   · el interruptor "Mostrar anuncios en la web" está en el panel (Ajustes, solo el OWNER);
//   · ADSENSE_CLIENTE y los ADSENSE_ESPACIO_* van en el .env.
// Si falta cualquiera de los dos, no se muestra nada. Un espacio sin identificador propio se
// saltea: no se dibuja un recuadro vacío.
//
// Los avisos son RESPONSIVOS: el alto lo decide Google según el ancho que tenga el hueco
// (data-ad-format="auto"), y el CSS (.anuncio) le reserva un mínimo para que la página no
// pegue un salto cuando el aviso termina de cargar.
//
// Hay DOS formas de trabajar, y las dos andan:
//   · "Auto ads" (lo más fácil): alcanza con ADSENSE_CLIENTE. Google decide solo dónde meter
//     los avisos. Es lo que pasa si no se configura ningún ADSENSE_ESPACIO_*.
//   · Espacios propios: en AdSense se crea un bloque por lugar y su número va en
//     ADSENSE_ESPACIO_PORTADA_ARRIBA / _ABAJO. Ahí los avisos salen solo donde nosotros
//     decidimos, que es lo recomendable para no tapar el ranking ni la tienda.
// =============================================================================
(function () {
  "use strict";

  const SCRIPT_ADSENSE = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  let scriptPedido = false;

  // El script de AdSense se carga UNA sola vez y recién cuando sabemos que hay que mostrarlos
  function cargarAdSense(cliente) {
    if (scriptPedido) return;
    scriptPedido = true;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = SCRIPT_ADSENSE + "?client=" + encodeURIComponent(cliente);
    document.head.appendChild(s);
  }

  function dibujar(hueco, cliente, espacio) {
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", cliente);
    ins.setAttribute("data-ad-slot", espacio);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    hueco.appendChild(ins);
    hueco.hidden = false;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // Si el navegador tiene un bloqueador, el hueco se esconde y la página sigue igual
      hueco.hidden = true;
    }
  }

  async function arrancar() {
    const huecos = document.querySelectorAll("[data-anuncio]");
    if (!huecos.length) return;

    let config;
    try {
      const r = await fetch("/api/ajustes/publicos");
      config = (await r.json()).anuncios;
    } catch (e) {
      return;   // sin respuesta, no se muestra nada
    }
    if (!config || !config.activos || !config.cliente) return;

    // Con solo el identificador ya alcanza: el script hace andar los "Auto ads".
    cargarAdSense(config.cliente);

    // Y si además hay espacios propios configurados, se dibujan donde los pusimos nosotros.
    for (const hueco of huecos) {
      const espacio = (config.espacios || {})[hueco.dataset.anuncio];
      if (espacio) dibujar(hueco, config.cliente, espacio);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
