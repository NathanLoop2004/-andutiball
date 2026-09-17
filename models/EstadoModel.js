// =============================================================================
// EstadoModel — el estado de una sala: quién está jugando, el marcador, los
// mensajes, los bans y la configuración con la que se levantó. Es lo que dibuja
// el panel.
//
// Solo el launcher puede mirar la sala de verdad (es el que tiene la página de
// Puppeteer), así que le pasa a la app un adaptador:
//
//     { estado: () => ({...}), expulsar: async (id, motivo, banear) => {} }
//
// Ese adaptador viaja en req.app.locals.sala. El panel corre sin adaptador: ahí
// no hay sala local y obtener() devuelve null a propósito.
// =============================================================================

const MAX_MENSAJES = 500;

class EstadoModel {
  // El objeto que se sirve en /api/estado. El launcher lo va completando con lo
  // que ve en la sala (link, jugadores, marcador, bans…).
  static crear({ sala, config = {}, roles = [], rangos = null, elo = [], divisiones = [] }) {
    return {
      sala: sala || "Sala",
      config,
      roles,
      rangos,
      elo,
      divisiones,
      encendida: false,
      problema: null,
      link: null,
      desde: null,
      jugadores: [],
      mensajes: [],
      bans: [],
      partido: { enJuego: false, red: 0, blue: 0 },
    };
  }

  // La consola de la sala en el panel: se guardan los últimos MAX_MENSAJES
  static agregarMensaje(estado, tipo, texto, datos = {}) {
    if (!estado) return;
    // Las contraseñas nunca quedan en el panel: "!clave loquesea" → "!clave ••••"
    if (typeof texto === "string") texto = texto.replace(/^(\s*!(?:clave|login|registrar|cambiarclave)\b)\s+\S.*$/i, "$1 ••••");
    estado.mensajes.push({ hora: new Date().toISOString(), tipo, texto, ...datos });
    if (estado.mensajes.length > MAX_MENSAJES) estado.mensajes.shift();
  }

  static obtener(sala) {
    return sala ? sala.estado() : null;
  }

  static async expulsar(sala, id, motivo, banear) {
    if (!sala) throw new Error("Esta instancia no maneja ninguna sala");
    await sala.expulsar(id, motivo, banear);
    return { ok: true };
  }
}

module.exports = EstadoModel;
module.exports.MAX_MENSAJES = MAX_MENSAJES;
