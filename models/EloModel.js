// =============================================================================
// EloModel — la tabla de puntajes, que viven en datos/elo.json (lado Node, no en
// localStorage) y que comparten las 4 salas.
//
// El cálculo está en lib/elo.js; este modelo es la puerta de entrada para la API.
// =============================================================================
const { DIVISIONES, leerElo, ranking, faltaParaSubir } = require("../lib/elo");
const Parametros = require("../lib/parametros");
const EloSalasModel = require("./EloSalasModel");

// Las pestañas del ranking: el general y las salas que tienen tabla de ELO
function ambitos() {
  const nombres = Object.fromEntries(Parametros.salas().map((s) => [s.clave, s.nombre]));
  // "🕸️ ÑandutíHax | Futsal 3v3 🇵🇾" → "Futsal 3v3"
  const corto = (n) => String(n || "").replace(/^.*\|\s*/, "").replace(/\s*🇵🇾\s*$/u, "").replace(/\s*⚽\s*$/u, "").trim();
  return [{ clave: "general", nombre: "General" }].concat(EloSalasModel.SALAS.map((s) => ({ clave: s, nombre: corto(nombres[s]) || s })));
}

// "general" o una sala con tabla; cualquier otra cosa es un error (nunca llega a un nombre de archivo)
function ambitoDe(pedido) {
  const a = String(pedido || "general").trim().toLowerCase();
  if (a === "general") return undefined;
  if (!EloSalasModel.tieneTabla(a)) throw new Error("Esa sala no tiene ranking");
  return a;
}

const TOPE_POR_DEFECTO = 200;

const tope = (limite, porDefecto, maximo) => {
  const n = Number.parseInt(limite, 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, maximo) : porDefecto;
};

// Lo que se puede mostrar de una ficha a cualquiera: sin la clave (lleva el auth del jugador)
const publica = (f, puesto) => ({
  puesto,
  nombre: f.nombre,
  elo: f.elo,
  partidos: f.partidos,
  ganados: f.ganados,
  empatados: f.empatados,
  perdidos: f.perdidos,
  goles: f.goles,
  division: { nombre: f.division.nombre, emoji: f.division.emoji, color: f.division.color, desde: f.division.desde },
});

class EloModel {
  // Para el panel de admins (trae la clave de cada ficha)
  static tabla(limite) {
    return {
      divisiones: DIVISIONES,
      ranking: ranking(leerElo(), tope(limite, TOPE_POR_DEFECTO, 1000)),
    };
  }

  // Para la web pública: los mejores, sin datos internos. Solo los que jugaron.
  static ambitos = ambitos;

  static rankingPublico(limite, sala) {
    const lista = ranking(leerElo(ambitoDe(sala)), 100000).filter((f) => f.partidos > 0);
    return {
      sala: sala || "general",
      salas: ambitos(),
      total: lista.length,
      ranking: lista.slice(0, tope(limite, 50, 200)).map((f, i) => publica(f, i + 1)),
    };
  }

  // La ficha de un nick (la tabla va por auth: si el mismo nick aparece más de una vez, se
  // queda con la que más partidos tiene). null si nunca jugó.
  static deNick(nick, sala) {
    const buscado = String(nick || "").trim().toLowerCase();
    if (!buscado) return null;
    const lista = ranking(leerElo(ambitoDe(sala)), 100000).filter((f) => f.partidos > 0);
    let elegido = null;
    let puesto = null;
    lista.forEach((f, i) => {
      if (String(f.nombre).trim().toLowerCase() !== buscado) return;
      if (!elegido || f.partidos > elegido.partidos) { elegido = f; puesto = i + 1; }
    });
    if (!elegido) return null;
    return { ...publica(elegido, puesto), total: lista.length, faltaParaSubir: faltaParaSubir(elegido.elo) };
  }

  // El de cada sala, para "Tu ELO"
  static porSala(nick) {
    return EloSalasModel.SALAS.map((s) => ({ sala: s, nombre: ambitos().find((a) => a.clave === s).nombre, elo: EloModel.deNick(nick, s) }));
  }
}

module.exports = EloModel;
