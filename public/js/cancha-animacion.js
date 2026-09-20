// =============================================================================
// cancha-animacion.js — la cancha que muestra cómo queda una animación de gol.
//
// Es la misma en el editor del panel (/frm/animaciones/) y en la página de cada animación
// (/frm/animacion/), así lo que ve el que la arma es exactamente lo que ve el que la compra.
//
// Dibuja una jugada que se repite sola, con los colores del mapa de verdad
// (mapas/nanduti-futsal-x3.hbs): fondo 2a3a40, líneas b3b6b6, áreas ff6363 y 0099ff,
// palos FFFF00, pelota FFD700.
//
//   AVANCE → los dos suben en diagonal, uno lleva la pelota
//   PASE   → se la pasan MIENTRAS se mueven (de borde a borde de cada disco)
//   REMATE → el que recibe remata corriendo
//   FESTEJO→ acá corre la animación: el emoji va ADENTRO del disco (como el avatar de
//            HaxBall) y el tamaño es el de cada punto
//   ESPERA → un respiro y vuelve a empezar
//
// Los discos no se pisan nunca, como en el juego.
//
// Uso:
//   const cancha = CanchaAnimacion.crear(document.getElementById("lienzo"), {
//     puntos: () => [{ emoji: "⚽", tamano: 1.5 }],   // se lee en cada cuadro
//     msPorCuadro: () => 200,
//     congelado: () => -1,           // opcional: con >= 0 se queda quieta en ese punto
//     alMostrarPunto: (i) => {},     // opcional: para mover el cabezal de la línea de tiempo
//     alCambiarFase: (texto) => {},  // opcional: el cartel de abajo
//     alAvanzar: (porciento) => {},  // opcional: la barra del festejo
//     conSegundos: true,             // false = el cartel no dice los segundos
//   });
//   cancha.arrancar();  ·  cancha.pausar()  ·  cancha.seguir()  ·  cancha.reiniciar()
// =============================================================================
window.CanchaAnimacion = {
  crear(lienzo, opciones) {
    const o = opciones || {};
    const ctx = lienzo.getContext("2d");
    const A = lienzo.width, AL = lienzo.height;

    // Cuánto dura cada parte de la jugada, en ms
    const AVANCE = 1100, PASE = 650, REMATE = 500, ESPERA = 700;

    // El mapa mide 620 x 300. Se dibuja a escala dejando margen a los costados, porque los
    // arcos sobresalen del borde de la cancha (como en HaxBall) y si no quedaban cortados.
    const ESC = A / 700;
    const cx = (x) => A / 2 + x * ESC;
    const cy = (y) => AL / 2 + y * ESC;
    const entre = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));
    const unDecimal = (n) => Number(n).toFixed(1).replace(".", ",");

    let corriendo = false;
    let t0 = performance.now();
    let ultimoPunto = -2;
    // Para no pedir dos cuadros a la vez: mientras se arrastra el cabezal el bucle se corta,
    // y al soltar hay que volver a arrancarlo aunque "corriendo" nunca se haya apagado.
    let enCola = false;
    const pedirCuadro = () => {
      if (enCola) return;
      enCola = true;
      requestAnimationFrame(() => { enCola = false; cuadro(); });
    };

    const puntos = () => (typeof o.puntos === "function" ? o.puntos() : []) || [];
    const paso = () => Math.max(60, Number(typeof o.msPorCuadro === "function" ? o.msPorCuadro() : 200) || 200);
    const congelado = () => (typeof o.congelado === "function" ? o.congelado() : -1);
    const avisarFase = (t) => { if (o.alCambiarFase) o.alCambiarFase(t); };
    const avisarPunto = (i) => { if (o.alMostrarPunto && i !== ultimoPunto) { ultimoPunto = i; o.alMostrarPunto(i); } };
    const avisarAvance = (p) => { if (o.alAvanzar) o.alAvanzar(p); };

    function dibujarCancha() {
      ctx.fillStyle = "#2a3a40";
      ctx.fillRect(0, 0, A, AL);

      ctx.lineWidth = 3 * ESC;
      ctx.strokeStyle = "#b3b6b6";
      ctx.strokeRect(cx(-310), cy(-150), 620 * ESC, 300 * ESC);
      ctx.beginPath(); ctx.moveTo(cx(0), cy(-150)); ctx.lineTo(cx(0), cy(150)); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx(0), cy(0), 70 * ESC, 0, Math.PI * 2); ctx.stroke();

      // Las áreas curvas de cada arco, como en el futsal de HaxBall
      const area = (lado, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4 * ESC;
        ctx.beginPath();
        ctx.moveTo(cx(lado * 310), cy(-130));
        ctx.bezierCurveTo(cx(lado * 180), cy(-130), cx(lado * 180), cy(130), cx(lado * 310), cy(130));
        ctx.stroke();
      };
      area(-1, "#ff6363");
      area(1, "#0099ff");

      // Los arcos: dos palos con su punto amarillo
      ctx.strokeStyle = "#F8F8F8";
      ctx.lineWidth = 4 * ESC;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx(lado * 310), cy(-42)); ctx.lineTo(cx(lado * 336), cy(-42));
        ctx.moveTo(cx(lado * 310), cy(42)); ctx.lineTo(cx(lado * 336), cy(42));
        ctx.moveTo(cx(lado * 336), cy(-42)); ctx.lineTo(cx(lado * 336), cy(42));
        ctx.stroke();
        for (const y of [-42, 42]) {
          ctx.beginPath();
          ctx.arc(cx(lado * 310), cy(y), 5 * ESC, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFF00";
          ctx.fill();
        }
      }
    }

    // Un jugador, como lo dibuja HaxBall: disco de color, borde oscuro y el avatar ADENTRO
    function jugadorHax(x, y, radio, color, avatar) {
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = Math.max(2, radio * 0.13);
      ctx.strokeStyle = "#000";
      ctx.stroke();
      if (avatar) {
        ctx.font = "600 " + Math.round(radio * 1.15) + "px 'Segoe UI Emoji', 'Apple Color Emoji', Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(avatar, x, y + radio * 0.04);
      }
    }

    function cuadro() {
      const lista = puntos();
      const ms = paso();
      const dura = Math.max(ms, lista.length * ms);
      const quieto = congelado();
      const estaCongelada = quieto >= 0;
      const total = AVANCE + PASE + REMATE + dura + ESPERA;
      const t = estaCongelada
        ? AVANCE + PASE + REMATE + Math.min(dura - 1, quieto * ms)
        : (performance.now() - t0) % total;

      dibujarCancha();

      const R = 15 * ESC;
      const RB = 5.76 * ESC;   // el radio de la pelota
      const suave = (p) => p * p * (3 - 2 * p);
      const m = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));

      // En HaxBall los jugadores y la pelota son DISCOS con colisión: nunca se superponen
      const versor = (a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d, d: d };
      };
      const borde = (a, b, radio) => {
        const u = versor(a, b);
        return { x: a.x + u.x * radio, y: a.y + u.y * radio };
      };

      const jugada = AVANCE + PASE + REMATE;
      const enFestejo = t - jugada;
      const festejando = enFestejo > 0;
      const recorrido = suave(Math.min(1, t / jugada));
      const corrida = festejando ? suave(Math.min(1, enFestejo / 1600)) : 0;

      // El que hace el gol: sube en diagonal y después se va festejando al córner
      let jxm = m(-235, 150, recorrido);
      let jym = m(70, -18, recorrido);
      if (festejando) { jxm = m(150, 235, corrida); jym = m(-18, -112, corrida); }

      // El compañero: sube por el otro carril y, si hay gol, va a abrazarlo
      let cxm = m(-290, 40, recorrido);
      let cym = m(-45, 92, recorrido);
      if (festejando) { cxm = m(40, 195, corrida); cym = m(92, -90, corrida); }

      const jugador = { x: cx(jxm), y: cy(jym) };
      const companiero = { x: cx(cxm), y: cy(cym) };
      const arquero = { x: cx(292), y: cy(m(-16, 8, (Math.sin(t / 650) + 1) / 2)) };
      const arco = { x: cx(316), y: cy(-26) };

      let pelota, escala = 1, fase, avatar = null;

      if (t < AVANCE) {
        fase = "Suben por la cancha";
        pelota = borde(companiero, arco, R + RB + 1);   // la lleva pegada al pie
      } else if (t < AVANCE + PASE) {
        fase = "Se la pasan en movimiento";
        const p = suave((t - AVANCE) / PASE);
        const sale = borde(companiero, jugador, R + RB);
        const llega = borde(jugador, companiero, R + RB);
        pelota = { x: entre(sale.x, llega.x, p), y: entre(sale.y, llega.y, p) };
      } else if (t < jugada) {
        fase = "Remata corriendo";
        const p = (t - AVANCE - PASE) / REMATE;
        const sale = borde(jugador, arco, R + RB);
        pelota = { x: entre(sale.x, arco.x, p * p), y: entre(sale.y, arco.y, p * p) };
      } else {
        pelota = arco;
        if (enFestejo < dura) {
          const i = estaCongelada ? quieto % Math.max(1, lista.length) : Math.floor(enFestejo / ms) % Math.max(1, lista.length);
          if (lista.length) {
            avatar = lista[i].emoji || null;
            escala = Number(lista[i].tamano) || 1;
            avisarPunto(i);
          }
          fase = estaCongelada
            ? "Punto " + (quieto + 1) + " de " + lista.length
            : o.conSegundos === false
              ? "¡Gol! Está festejando"
              : "¡Gol! Festejando " + unDecimal(enFestejo / 1000) + " / " + unDecimal(dura / 1000) + " s";
        } else {
          fase = o.conSegundos === false ? "" : "Se acabó el festejo: el bot recién acá acomoda a la gente";
        }
      }

      // Dos jugadores tampoco pueden estar uno encima del otro (pasa al festejar)
      {
        const u = versor(jugador, companiero);
        const minimo = R * escala + R;
        if (u.d < minimo) {
          const empuje = (minimo - u.d) / 2;
          companiero.x += u.x * empuje;
          companiero.y += u.y * empuje;
          jugador.x -= u.x * empuje;
          jugador.y -= u.y * empuje;
        }
      }

      jugadorHax(arquero.x, arquero.y, R, "#5689E5", null);
      jugadorHax(companiero.x, companiero.y, R, "#E56E56", null);
      jugadorHax(jugador.x, jugador.y, R * escala, "#E56E56", avatar);

      ctx.beginPath();
      ctx.arc(pelota.x, pelota.y, RB, 0, Math.PI * 2);
      ctx.fillStyle = "#FFD700";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();

      if (!(enFestejo > 0 && enFestejo < dura)) avisarPunto(-1);
      avisarFase(fase);
      avisarAvance(enFestejo > 0 && enFestejo < dura ? (enFestejo / dura) * 100 : (enFestejo >= dura ? 100 : 0));

      if (corriendo && !estaCongelada) pedirCuadro();
    }

    return {
      arrancar() { corriendo = true; t0 = performance.now(); ultimoPunto = -2; pedirCuadro(); },
      pausar() { corriendo = false; },
      // Vuelve a arrancar el bucle SIEMPRE: se usa también al soltar el cabezal, y ahí
      // "corriendo" nunca se apagó pero el bucle sí se cortó.
      seguir() { corriendo = true; t0 = performance.now(); ultimoPunto = -2; pedirCuadro(); },
      reiniciar() { t0 = performance.now(); ultimoPunto = -2; },
      estaCorriendo() { return corriendo; },
      dibujarUno() { cuadro(); },   // un solo cuadro (para cuando está congelada)
    };
  },
};
