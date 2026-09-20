// =============================================================================
// mercado.js — los datos de mercado de una cosa de la tienda: cómo se fue moviendo el
// precio, cuánta gente la compró y a cuánta le gusta.
//
// Lo usan /frm/camiseta/ y /frm/animacion/, que muestran lo mismo.
// De los favoritos sale SOLO el número: nunca quiénes son.
// =============================================================================
window.Mercado = {
  // Dibuja todo adentro del contenedor que se le pase
  async pintar(donde, tipo, clave) {
    if (!donde) return;
    let f;
    try {
      f = await Sesion.pedir("/api/mercado/" + encodeURIComponent(tipo) + "/" + encodeURIComponent(clave));
    } catch (e) {
      return;   // sin estos datos la página igual sirve
    }

    const n = (x) => Number(x || 0);
    const gente = (cuantos, uno, muchos) =>
      cuantos === 0 ? "Todavía nadie" : cuantos === 1 ? "1 " + uno : cuantos + " " + muchos;

    donde.innerHTML = `
      <div class="mercado">
        <div class="mercado-numeros">
          <div class="mercado-dato">
            <b>${n(f.compraron)}</b>
            <span>${f.compraron === 1 ? "la compró" : "la compraron"}</span>
          </div>
          <div class="mercado-dato">
            <b>${n(f.favoritos)}</b>
            <span>${f.favoritos === 1 ? "la tiene en favoritos" : "la tienen en favoritos"}</span>
          </div>
          <button class="boton chico corazon${f.esFavorito ? " marcado" : ""}" type="button" id="favorito" hidden>
            ${f.esFavorito ? "★ En tus favoritos" : "☆ Agregar a favoritos"}
          </button>
        </div>
        <div id="historialPrecio"></div>
      </div>`;

    Mercado.pintarHistorial(document.getElementById("historialPrecio"), f);

    // El botón de favoritos solo tiene sentido con sesión
    const boton = document.getElementById("favorito");
    if (Sesion.usuario()) {
      boton.hidden = false;
      boton.onclick = async () => {
        boton.disabled = true;
        try {
          await Sesion.pedir("/api/favoritos", { method: "POST", body: JSON.stringify({ tipo, clave }) });
          await Mercado.pintar(donde, tipo, clave);   // se vuelve a dibujar con el número nuevo
        } catch (e) { boton.disabled = false; }
      };
    }
  },

  // El historial: una barrita por cambio de precio, de la más vieja a la más nueva
  pintarHistorial(donde, f) {
    if (!donde) return;
    const h = f.historial || [];
    if (h.length < 2) {
      donde.innerHTML = h.length
        ? '<p class="tenue chico">Nunca le cambiaron el precio.</p>'
        : "";
      return;
    }

    const maximo = Math.max(...h.map((x) => x.precio)) || 1;
    const fecha = (d) => new Date(d).toLocaleDateString("es-PY", { day: "numeric", month: "short" });
    const monedas = (x) => Number(x).toFixed(2).replace(/.00$/, "").replace(/(.d)0$/, "$1").replace(".", ",");

    donde.innerHTML = `
      <div class="historial-titulo">Cómo se fue moviendo el precio</div>
      <div class="historial">
        ${h.map((x) => `
          <div class="historial-punto" title="${monedas(x.precio)} monedas · ${fecha(x.cuando)}">
            <i style="height:${Math.max(6, Math.round((x.precio / maximo) * 52))}px"></i>
            <small>${monedas(x.precio)}</small>
          </div>`).join("")}
      </div>
      <p class="tenue chico">
        Cambió de precio ${f.cambiosDePrecio} ${f.cambiosDePrecio === 1 ? "vez" : "veces"}.
        Lo más barato que estuvo: ${monedas(f.masBarato)} 🪙 · lo más caro: ${monedas(f.masCaro)} 🪙.
      </p>`;
  },
};
