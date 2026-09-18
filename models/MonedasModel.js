// =============================================================================
// MonedasModel — las monedas de cada cuenta (tabla `monedas`) y su historial
// (tabla `movimientos_monedas`).
//
// CÓMO SE GANAN (solo el equipo que GANA el partido, y solo cuentas de la web con su clave puesta):
//
//   🏆 Ganar el partido ............ 1 moneda, para todos los del equipo ganador
//   ⚽ Cada gol .................... 1 moneda, hasta 3 por partido (el hat-trick es el tope)
//   🅰️ Cada asistencia ............. 1 moneda, hasta 3 por partido
//   🧤 Cada atajada del arquero .... 0,30 monedas, hasta 3 monedas por partido
//
// El que pierde o empata no cobra nada, aunque haya hecho goles.
//
// El saldo se guarda en CENTÉSIMAS (1 moneda = 100): así 0,30 no arrastra decimales rotos.
// Para mostrar se divide por 100 (enMonedas).
// =============================================================================
const { base } = require("../services/ConexionBase");

const CENTESIMAS = 100;

const PREMIOS = {
  ganar: 1 * CENTESIMAS,
  gol: 1 * CENTESIMAS,
  asistencia: 1 * CENTESIMAS,
  atajada: 0.3 * CENTESIMAS,
};

// Topes por partido (en centésimas): el hat-trick es lo máximo que paga
const TOPES = {
  gol: 3 * CENTESIMAS,
  asistencia: 3 * CENTESIMAS,
  atajada: 3 * CENTESIMAS,
};

const MOTIVOS = {
  ganar: "Ganaste el partido",
  gol: "Goles",
  asistencia: "Asistencias",
  atajada: "Atajadas",
};

const enMonedas = (centesimas) => Math.round(Number(centesimas || 0)) / CENTESIMAS;
const aCentesimas = (monedas) => Math.round(Number(monedas || 0) * CENTESIMAS);
const nombreDe = (j) => String((j && (j.nombre || j.name)) || "").trim();
const cuantos = (mapa, nombre) => {
  if (!mapa) return 0;
  const bajo = String(nombre).toLowerCase();
  for (const [k, v] of Object.entries(mapa)) if (String(k).toLowerCase() === bajo) return Number(v) || 0;
  return 0;
};

class MonedasModel {
  static PREMIOS = PREMIOS;
  static TOPES = TOPES;
  static CENTESIMAS = CENTESIMAS;
  static enMonedas = enMonedas;
  static aCentesimas = aCentesimas;

  /**
   * Lo que le toca a cada uno por un partido. NO toca la base: solo calcula.
   * @param partido { red, blue, ganador (1|2|0), goles, asistencias, atajadas } (por nombre)
   * @param puedeCobrar(jugador) → true si tiene cuenta en la web y puso su clave
   * @returns [{ nombre, total, lineas: [{ motivo, cantidad, monto }] }] — solo los que cobran algo
   */
  static calcular(partido, puedeCobrar = () => true) {
    if (!partido || !partido.ganador) return [];   // empate o partido sin ganador: nadie cobra
    const ganadores = partido.ganador === 1 ? partido.red || [] : partido.blue || [];

    const salida = [];
    for (const jugador of ganadores) {
      if (!puedeCobrar(jugador)) continue;
      const nombre = nombreDe(jugador);
      if (!nombre) continue;

      const lineas = [{ motivo: "ganar", cantidad: 1, monto: PREMIOS.ganar }];
      const sumar = (motivo, cantidad) => {
        if (cantidad <= 0) return;
        const monto = Math.min(cantidad * PREMIOS[motivo], TOPES[motivo]);
        if (monto > 0) lineas.push({ motivo, cantidad, monto });
      };
      sumar("gol", cuantos(partido.goles, nombre));
      sumar("asistencia", cuantos(partido.asistencias, nombre));
      sumar("atajada", cuantos(partido.atajadas, nombre));

      salida.push({ nombre, total: lineas.reduce((s, l) => s + l.monto, 0), lineas });
    }
    return salida;
  }

  // Suma (o resta, con monto negativo) monedas y deja el movimiento en el historial
  static async acreditar({ nick, monto, motivo, detalle = null, sala = null, partidoId = null }) {
    const nombre = String(nick || "").trim();
    if (!nombre) throw new Error("Falta el nick");
    const cantidad = Math.round(Number(monto) || 0);
    if (!cantidad) return null;

    return base().$transaction(async (tx) => {
      const actual = await tx.monedas.findUnique({ where: { nick: nombre } });
      const saldo = (actual ? actual.saldo : 0) + cantidad;
      if (saldo < 0) throw new Error("No te alcanzan las monedas");
      const datos = {
        saldo,
        ganadas: (actual ? actual.ganadas : 0) + (cantidad > 0 ? cantidad : 0),
        gastadas: (actual ? actual.gastadas : 0) + (cantidad < 0 ? -cantidad : 0),
        actualizado: new Date(),
      };
      await tx.monedas.upsert({ where: { nick: nombre }, update: datos, create: { nick: nombre, ...datos } });
      return tx.movimientoMonedas.create({
        data: { nick: nombre, monto: cantidad, motivo, detalle, sala, partidoId, saldoDespues: saldo },
      });
    });
  }

  /**
   * Calcula el partido y lo guarda. Devuelve lo mismo que calcular(), con el saldo nuevo:
   * [{ nombre, total, lineas, saldo }] — el launcher se lo manda a la sala para avisarle a cada uno.
   */
  static async porPartido(partido, { sala = null, partidoId = null, puedeCobrar } = {}) {
    const premios = MonedasModel.calcular(partido, puedeCobrar);
    const salida = [];
    for (const premio of premios) {
      const detalle = premio.lineas
        .map((l) => (l.motivo === "ganar" ? MOTIVOS.ganar : `${l.cantidad} ${MOTIVOS[l.motivo].toLowerCase()}`))
        .join(" · ");
      const movimiento = await MonedasModel.acreditar({
        nick: premio.nombre,
        monto: premio.total,
        motivo: "partido",
        detalle,
        sala,
        partidoId,
      });
      salida.push({ ...premio, saldo: movimiento ? movimiento.saldoDespues : null });
    }
    return salida;
  }

  static async saldo(nick) {
    const fila = await base().monedas.findUnique({ where: { nick: String(nick || "").trim() } });
    return fila ? fila.saldo : 0;
  }

  static async historial(nick, limite = 20) {
    const filas = await base().movimientoMonedas.findMany({
      where: { nick: String(nick || "").trim() },
      orderBy: { creado: "desc" },
      take: Math.min(Math.max(Number(limite) || 20, 1), 100),
    });
    return filas.map((f) => ({
      id: f.id,
      monto: enMonedas(f.monto),
      motivo: f.motivo,
      detalle: f.detalle,
      sala: f.sala,
      saldo: enMonedas(f.saldoDespues),
      cuando: f.creado,
    }));
  }

  // Lo que necesita "Mi cuenta": { monedas, ganadas, gastadas, historial }
  static async fichaDe(nick, limite = 10) {
    const nombre = String(nick || "").trim();
    const fila = await base().monedas.findUnique({ where: { nick: nombre } });
    return {
      monedas: enMonedas(fila ? fila.saldo : 0),
      ganadas: enMonedas(fila ? fila.ganadas : 0),
      gastadas: enMonedas(fila ? fila.gastadas : 0),
      historial: await MonedasModel.historial(nombre, limite),
    };
  }
}

module.exports = MonedasModel;
module.exports.MOTIVOS = MOTIVOS;
