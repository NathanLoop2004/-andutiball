// =============================================================================
// RachasModel — cuántos partidos seguidos viene ganando cada cuenta (tabla `rachas`).
//
//   actual  → las que lleva ganadas seguidas ahora mismo (se corta al perder o empatar)
//   mejor   → la racha más larga que hizo, con la fecha en que la logró
//
// Se actualiza al terminar cada partido, con los mismos que cobran ELO: cuentas de la web que
// pusieron su clave en la sala. En la portada hay un cuadro con las mejores rachas.
// =============================================================================
const { base } = require("../services/ConexionBase");

const PREMIOS_DE_RACHA = [3, 5, 10, 15, 20];   // en estas se avisa en la sala

class RachasModel {
  /**
   * Anota el partido de cada uno y devuelve lo que pasó, para avisarlo en la sala.
   * @param ganadores nicks que ganaron · perdedores los demás (pierden o empatan)
   * @returns [{ nick, actual, mejor, record: true si acaba de superar su mejor }]
   */
  static async anotarPartido({ ganadores = [], perdedores = [] } = {}) {
    const salida = [];
    const ahora = new Date();

    for (const nick of ganadores) {
      const nombre = String(nick || "").trim();
      if (!nombre) continue;
      const antes = await base().racha.findUnique({ where: { nick: nombre } });
      const actual = (antes ? antes.actual : 0) + 1;
      const mejorAntes = antes ? antes.mejor : 0;
      const record = actual > mejorAntes;
      const datos = {
        actual,
        mejor: Math.max(actual, mejorAntes),
        partidos: (antes ? antes.partidos : 0) + 1,
        ganados: (antes ? antes.ganados : 0) + 1,
        ultimoResultado: "ganó",
        mejorCuando: record ? ahora : (antes ? antes.mejorCuando : null),
        actualizada: ahora,
      };
      await base().racha.upsert({ where: { nick: nombre }, update: datos, create: { nick: nombre, ...datos } });
      salida.push({ nick: nombre, actual, mejor: datos.mejor, record, premio: PREMIOS_DE_RACHA.includes(actual) });
    }

    for (const nick of perdedores) {
      const nombre = String(nick || "").trim();
      if (!nombre) continue;
      const antes = await base().racha.findUnique({ where: { nick: nombre } });
      const cortada = antes ? antes.actual : 0;
      const datos = {
        actual: 0,
        mejor: antes ? antes.mejor : 0,
        partidos: (antes ? antes.partidos : 0) + 1,
        ganados: antes ? antes.ganados : 0,
        ultimoResultado: "no ganó",
        mejorCuando: antes ? antes.mejorCuando : null,
        actualizada: ahora,
      };
      await base().racha.upsert({ where: { nick: nombre }, update: datos, create: { nick: nombre, ...datos } });
      if (cortada >= 3) salida.push({ nick: nombre, actual: 0, mejor: datos.mejor, cortada });
    }

    return salida;
  }

  // Las mejores rachas de la historia (para la portada). Público: solo nick y números.
  static async mejores(limite = 10) {
    const filas = await base().racha.findMany({
      where: { mejor: { gt: 0 } },
      orderBy: [{ mejor: "desc" }, { actualizada: "asc" }],
      take: Math.min(Math.max(Number(limite) || 10, 1), 50),
    });
    return filas.map((f, i) => ({
      puesto: i + 1,
      nick: f.nick,
      mejor: f.mejor,
      actual: f.actual,
      partidos: f.partidos,
      ganados: f.ganados,
      cuando: f.mejorCuando,
    }));
  }

  // Las que están vivas ahora mismo (el que viene ganando)
  static async enCurso(limite = 5) {
    const filas = await base().racha.findMany({
      where: { actual: { gte: 2 } },
      orderBy: [{ actual: "desc" }, { actualizada: "desc" }],
      take: Math.min(Math.max(Number(limite) || 5, 1), 20),
    });
    return filas.map((f) => ({ nick: f.nick, actual: f.actual, mejor: f.mejor }));
  }

  static async deNick(nick) {
    const fila = await base().racha.findUnique({ where: { nick: String(nick || "").trim() } });
    return fila
      ? { actual: fila.actual, mejor: fila.mejor, partidos: fila.partidos, ganados: fila.ganados, cuando: fila.mejorCuando }
      : { actual: 0, mejor: 0, partidos: 0, ganados: 0, cuando: null };
  }
}

module.exports = RachasModel;
module.exports.PREMIOS_DE_RACHA = PREMIOS_DE_RACHA;
