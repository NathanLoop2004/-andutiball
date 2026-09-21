// =============================================================================
// cartel-cancha.js — cómo se ve un cartel de gol ARRIBA DE LA CANCHA.
//
// Es la vista previa de lo que muestra la extensión de ÑandutíHax (public/nandutihax.user.js)
// cuando alguien convierte: tapa el "Blue Scores!" de HaxBall con el cartel que compró el
// goleador. Acá se dibuja igual, para que el que arma el cartel en el panel y el que lo
// compra en la web vean exactamente lo mismo que van a ver jugando.
//
// La cancha y la jugada las pone CanchaAnimacion (el mismo archivo que usan las animaciones
// de gol): los dos rojos suben, se la pasan, rematan… y en el festejo aparece el cartel.
//
// EL TAMAÑO Y EL COLOR SE CALCULAN IGUAL QUE EN LA EXTENSIÓN. Si allá se cambian, acá
// también, o la vista previa empieza a mentir.
//
// Uso:
//   const vista = CartelCancha.crear(document.getElementById("caja"), {
//     cartel: () => ({ texto: "⚽ ¡GOLAZO!", color: "#FFD700", estilo: "bold" }),
//   });
//   vista.arrancar();  ·  vista.parar()  ·  vista.refrescar()
// =============================================================================
window.CartelCancha = {
  // Los mismos factores que usa el userscript para el tamaño de la letra
  TAMANO: { bold: 1, normal: 0.85, small: 0.72 },

  crear(caja, opciones) {
    const o = opciones || {};
    const ancho = o.ancho || 520;
    const alto = o.alto || Math.round(ancho * 0.52);

    caja.classList.add("cartel-cancha");
    caja.innerHTML =
      '<canvas width="' + ancho + '" height="' + alto + '"></canvas>' +
      '<div class="cartel-encima"><span></span></div>';
    const lienzo = caja.querySelector("canvas");
    const encima = caja.querySelector(".cartel-encima");
    const texto = encima.querySelector("span");

    // Se acomoda donde HaxBall escribe su "Scores!": arriba del medio de la cancha
    encima.style.top = Math.round(alto * 0.28) + "px";
    encima.style.height = Math.max(54, Math.round(alto * 0.34)) + "px";

    const pintar = () => {
      const c = (o.cartel && o.cartel()) || {};
      const factor = window.CartelCancha.TAMANO[c.estilo] || 1;
      texto.style.fontSize = Math.max(11, Math.min(26, (ancho / 26) * factor)) + "px";

      // Con colores por letra (el cartel de inicio) se arma letra por letra, igual que en la
      // extensión; si no, va todo de un color.
      const lista = c.colores || [];
      if (lista.length) {
        texto.textContent = "";
        [...String(c.texto || "")].forEach((letra, i) => {
          const span = document.createElement("span");
          span.textContent = letra;
          span.style.color = "#" + String(lista[i] || lista[lista.length - 1] || "FFD700").replace(/^#/, "");
          texto.appendChild(span);
        });
      } else {
        texto.textContent = c.texto || "";
        texto.style.color = c.color || "#FFD700";
      }
    };

    let festejando = false;
    const cancha = CanchaAnimacion.crear(lienzo, {
      // Un solo punto sin emoji: acá lo que importa es el cartel, no la animación del avatar.
      // El festejo dura lo mismo que el cartel en el juego (CanchaAnimacion: puntos × ms).
      puntos: () => [{ emoji: "", tamano: 1 }],
      msPorCuadro: () => 3200,
      conSegundos: false,
      alCambiarFase: (fase) => {
        const ahora = /Gol/.test(fase || "");
        if (ahora === festejando) return;
        festejando = ahora;
        if (ahora) pintar();
        encima.classList.toggle("viendose", ahora);
      },
    });

    pintar();
    return {
      arrancar: () => cancha.arrancar(),
      parar: () => cancha.pausar(),
      refrescar: pintar,          // para el editor, que cambia mientras se escribe
    };
  },
};
