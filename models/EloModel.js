// =============================================================================
// EloModel — la tabla de puntajes, que viven en datos/elo.json (lado Node, no en
// localStorage) y que comparten las 4 salas.
//
// El cálculo está en lib/elo.js; este modelo es la puerta de entrada para la API.
// =============================================================================
const { DIVISIONES, leerElo, ranking } = require("../lib/elo");

const TOPE_POR_DEFECTO = 200;

class EloModel {
  static tabla(limite) {
    const tope = Number.parseInt(limite, 10);
    return {
      divisiones: DIVISIONES,
      ranking: ranking(leerElo(), Number.isInteger(tope) && tope > 0 ? Math.min(tope, 1000) : TOPE_POR_DEFECTO),
    };
  }
}

module.exports = EloModel;
