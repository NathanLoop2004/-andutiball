// =============================================================================
// EloSalasModel — el ELO de cada sala y el general, en la base.
//
//   Tablas:        elo_3v3 · elo_4v4 · elo_todos · elo_realsoccer · elo_general
//   Procedimiento: actualizar_elo_general(claves)  → recalcula el general desde las salas
//
// Al terminar un partido (procesarPartido):
//   1. se lee la tabla de la sala, se aplica el partido (lib/elo.js) y se guardan esas filas;
//   2. CALL actualizar_elo_general(los que jugaron) → el general sale de la base;
//   3. se escriben los archivos espejo (datos/elo-<sala>.json y datos/elo.json), que son lo que
//      leen la sala (color, !elo, !top) y la web.
//
// Si la base está apagada, se hace lo mismo sobre los archivos y el general se calcula en Node con
// la misma fórmula (calcularGeneral). Las salas nunca dejan de sumar.
// =============================================================================
const { base } = require("../services/ConexionBase");
const Elo = require("../lib/elo");

// Las tablas que existen. El nombre de la tabla va en SQL: solo sale de esta lista, nunca del pedido.
const TABLAS = {
  "3v3": "elo_3v3",
  "4v4": "elo_4v4",
  todos: "elo_todos",
  realsoccer: "elo_realsoccer",
};
const TABLA_GENERAL = "elo_general";
const SALAS = Object.keys(TABLAS);

const tablaDe = (sala) => {
  const t = TABLAS[sala];
  if (!t) throw new Error(`La sala "${sala}" no tiene tabla de ELO`);
  return t;
};

// Filas de la base → el mismo formato que los archivos: { clave: { nombre, elo, … } }
const aTabla = (filas) => {
  const tabla = {};
  for (const f of filas) {
    tabla[f.clave] = {
      nombre: f.nombre, elo: f.elo, partidos: f.partidos, ganados: f.ganados, empatados: f.empatados,
      perdidos: f.perdidos, goles: f.goles, actualizado: new Date(f.actualizado).toISOString(),
    };
  }
  return tabla;
};

async function leerTabla(nombreTabla) {
  const filas = await base().$queryRawUnsafe(`SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "${nombreTabla}"`);
  return aTabla(filas);
}

async function guardarFilas(nombreTabla, tabla, claves) {
  for (const clave of claves) {
    const f = tabla[clave];
    if (!f) continue;
    await base().$executeRawUnsafe(
      `INSERT INTO "${nombreTabla}" (clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (clave) DO UPDATE SET nombre = EXCLUDED.nombre, elo = EXCLUDED.elo, partidos = EXCLUDED.partidos,
         ganados = EXCLUDED.ganados, empatados = EXCLUDED.empatados, perdidos = EXCLUDED.perdidos,
         goles = EXCLUDED.goles, actualizado = EXCLUDED.actualizado`,
      clave, f.nombre, f.elo, f.partidos, f.ganados, f.empatados, f.perdidos, f.goles, new Date(f.actualizado || Date.now())
    );
  }
}

class EloSalasModel {
  static SALAS = SALAS;
  static TABLAS = TABLAS;

  static tieneTabla(sala) {
    return Boolean(TABLAS[sala]);
  }

  // Recalcula el general con el procedimiento de la base. Sin claves: a todos.
  static async actualizarGeneral(claves = null) {
    if (claves && claves.length) await base().$executeRawUnsafe(`CALL actualizar_elo_general($1::text[])`, claves);
    else await base().$executeRawUnsafe(`CALL actualizar_elo_general()`);
  }

  static async tablaSala(sala) {
    return leerTabla(tablaDe(sala));
  }

  static async tablaGeneral() {
    return leerTabla(TABLA_GENERAL);
  }

  // Deja los archivos iguales a la base (lo que leen la sala y la web)
  static async espejar(salas = SALAS) {
    for (const sala of salas) Elo.guardarElo(await EloSalasModel.tablaSala(sala), sala);
    Elo.guardarElo(await EloSalasModel.tablaGeneral());
  }

  // Al abrir una sala: si la base está vacía y los archivos tienen datos (se jugó con la base
  // apagada), se suben los archivos a la base. Si no, la base manda y se pisan los archivos.
  static async sincronizar() {
    let subidas = 0;
    for (const sala of SALAS) {
      const enBase = await EloSalasModel.tablaSala(sala);
      const enArchivo = Elo.leerElo(sala);
      if (!Object.keys(enBase).length && Object.keys(enArchivo).length) {
        await guardarFilas(tablaDe(sala), enArchivo, Object.keys(enArchivo));
        subidas += Object.keys(enArchivo).length;
      }
    }
    if (subidas) await EloSalasModel.actualizarGeneral();
    await EloSalasModel.espejar();
    return { subidas };
  }

  /**
   * Aplica un partido terminado a la sala y recalcula el general.
   * @returns { cambios (del ELO de la sala), general: { clave: elo }, enBase: boolean }
   */
  static async procesarPartido(sala, evento) {
    if (!TABLAS[sala]) throw new Error(`La sala "${sala}" no tiene tabla de ELO`);
    try {
      const tabla = await EloSalasModel.tablaSala(sala);
      const cambios = Elo.aplicarPartido(tabla, evento);
      if (!cambios.length) return { cambios, general: {}, enBase: true };
      const claves = [...evento.red, ...evento.blue].map((j) => Elo.claveDe(j));
      await guardarFilas(tablaDe(sala), tabla, claves);
      await EloSalasModel.actualizarGeneral(claves);
      await EloSalasModel.espejar([sala]);
      const general = Elo.leerElo();
      return { cambios, general: EloSalasModel._elosDe(general, claves), enBase: true };
    } catch (error) {
      if (!/No se pudo abrir la base|Can't reach database|ECONNREFUSED|P1001|connect/i.test(error.message)) throw error;
      // Sin base: los archivos, con la misma cuenta
      const tabla = Elo.leerElo(sala);
      const cambios = Elo.aplicarPartido(tabla, evento);
      if (!cambios.length) return { cambios, general: {}, enBase: false };
      Elo.guardarElo(tabla, sala);
      const general = Elo.calcularGeneral(Object.fromEntries(SALAS.map((s) => [s, Elo.leerElo(s)])));
      Elo.guardarElo(general);
      const claves = [...evento.red, ...evento.blue].map((j) => Elo.claveDe(j));
      return { cambios, general: EloSalasModel._elosDe(general, claves), enBase: false };
    }
  }

  static _elosDe(tabla, claves) {
    const salida = {};
    for (const c of claves) if (tabla[c]) salida[c] = tabla[c].elo;
    return salida;
  }
}

module.exports = EloSalasModel;
