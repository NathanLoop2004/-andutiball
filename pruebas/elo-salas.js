// Prueba el ELO por sala y el general:
//
//   npm run prueba-elo-salas
//
//   · la cuenta del general (promedio pesado por partidos) en Node;
//   · contra la base: cada partido solo toca la tabla de su sala, y el procedimiento
//     actualizar_elo_general() da LO MISMO que la cuenta en Node;
//   · solo suman los que tienen cuenta (con clave) y pusieron !clave en la sala;
//   · sin base: no se puede confirmar ninguna cuenta y el partido no suma a nadie.
//
// Los archivos van a una carpeta temporal (ELO_FILE) y en la base se usan claves de prueba que
// se borran al final: no toca los puntajes de verdad.

const fs = require("fs");
const os = require("os");
const path = require("path");

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "nanduti-elo-salas-"));
process.env.ELO_FILE = path.join(temporal, "elo.json");

const Elo = require("../lib/elo");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const marca = "prueba" + Date.now();
const jugador = (n) => ({ nombre: n + marca.slice(-4), auth: marca + "-" + n, verificado: true });
const [ANA, BETO, CARO, DANI] = ["ana", "beto", "caro", "dani"].map(jugador);
const EMA = jugador("ema");                                  // juega, pero no tiene cuenta
const FEDE = { ...jugador("fede"), verificado: false };      // tiene cuenta, pero no puso !clave
const clave = (j) => Elo.claveDe(j);

(async () => {
  // ── 1) La cuenta ──
  console.log("🧮 La cuenta del general:\n");
  const g = Elo.calcularGeneral({
    "3v3": { "auth:x": { nombre: "Viejo", elo: 1100, partidos: 30, ganados: 20, empatados: 0, perdidos: 10, goles: 40, actualizado: "2026-01-01" } },
    realsoccer: { "auth:x": { nombre: "Nuevo", elo: 900, partidos: 10, ganados: 2, empatados: 1, perdidos: 7, goles: 3, actualizado: "2026-02-01" } },
  })["auth:x"];
  revisar("Promedio pesado por partidos: 30 a 1100 y 10 a 900 dan 1050", g.elo === 1050, g.elo);
  revisar("Partidos, ganados y goles se suman", g.partidos === 40 && g.ganados === 22 && g.goles === 43);
  revisar("Se queda con el último nombre", g.nombre === "Nuevo", g.nombre);
  revisar("Un nombre de sala raro no llega a un archivo", (() => { try { Elo.archivoDe("../../.env"); return false; } catch (e) { return true; } })());

  // ── En la sala: !elo, !top y !top general ──
  console.log("\n🏟️  Los comandos en la sala:\n");
  const { abrirSala } = require("./sala-falsa");
  const sala = abrirSala("hosts/3v3.json");
  const ficha = (nombre, elo, partidos) => ({ nombre, elo, partidos, division: Elo.divisionDe(elo).nombre, emoji: Elo.divisionDe(elo).emoji, color: parseInt(Elo.divisionDe(elo).color, 16) });
  sala.contexto.__eloActualizar({
    sala: { ana: ficha("Ana", 1100, 5), beto: ficha("Beto", 950, 5) },
    general: { ana: ficha("Ana", 1040, 12), beto: ficha("Beto", 990, 9), caro: ficha("Caro", 1200, 20) },
  });
  const ana = sala.entra(1, "Ana");
  sala.avanzar(3000);
  sala.anuncios.length = 0;
  sala.chat(ana, "!elo");
  const textoElo = sala.anuncios.find((a) => a.includes("Ana")) || "";
  revisar("!elo muestra el ELO de la sala y el general", /En esta sala: .*1100 pts/.test(textoElo) && /General: .*1040 pts/.test(textoElo), textoElo);
  sala.avanzar(6000);
  sala.anuncios.length = 0;
  sala.chat(ana, "!top");
  revisar("!top es el de esta sala, con los nombres (antes salía undefined)", sala.anuncios.some((a) => /de esta sala/.test(a)) && sala.anuncios.some((a) => /Ana — 1100/.test(a)) && !sala.anuncios.some((a) => /undefined/.test(a)) && !sala.anuncios.some((a) => /Caro/.test(a)));
  sala.avanzar(6000);
  sala.anuncios.length = 0;
  sala.chat(ana, "!top general");
  revisar("!top general es el de las 4 salas", sala.anuncios.some((a) => /general/.test(a)) && sala.anuncios.some((a) => /Caro — 1200/.test(a)));
  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) Sin base: nadie suma ──
  console.log("\n📁 Sin base:\n");
  const rutaConexion = require.resolve("../services/ConexionBase");
  const rutaModelo = require.resolve("../models/EloSalasModel");
  const real = require(rutaConexion);
  require.cache[rutaConexion].exports = { ...real, base: () => { throw new Error("No se pudo abrir la base (desarrollo): prueba"); } };
  delete require.cache[rutaModelo];
  const SinBase = require(rutaModelo);
  const r1 = await SinBase.procesarPartido("3v3", { red: [ANA], blue: [BETO], ganador: 1, goles: { [ANA.nombre]: 1 } });
  const r2 = await SinBase.procesarPartido("realsoccer", { red: [ANA], blue: [BETO], ganador: 2, goles: {} });
  revisar("Sin base no se puede confirmar cuentas: no suma nadie", r1.cambios.length === 0 && r1.enBase === false && r2.cambios.length === 0);
  revisar("Sin base no se escribe ningún archivo", !Object.keys(Elo.leerElo("3v3")).length && !Object.keys(Elo.leerElo()).length);
  revisar("Avisa a quiénes no se les sumó", r1.sinCuenta.length === 2, r1.sinCuenta.join(", "));
  require.cache[rutaConexion].exports = real;
  delete require.cache[rutaModelo];
  for (const f of fs.readdirSync(temporal)) fs.unlinkSync(path.join(temporal, f));

  // ── 3) Con base: tablas y procedimiento ──
  console.log("\n🗄️  Contra la base (tablas y procedimiento):\n");
  const { hayBase, base, cerrarBase } = real;
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar(cerrarBase);
  }
  const EloSalas = require(rutaModelo);
  const nuestras = [ANA, BETO, CARO, DANI, EMA, FEDE].map(clave);
  const conCuenta = [ANA, BETO, CARO, DANI, FEDE];
  const limpiar = async () => {
    await base().usuario.deleteMany({ where: { nick: { in: [...conCuenta, EMA].map((j) => j.nombre) } } });
    for (const t of [...Object.values(EloSalas.TABLAS), "elo_general"]) {
      await base().$executeRawUnsafe(`DELETE FROM "${t}" WHERE clave = ANY($1::text[])`, nuestras);
    }
  };

  try {
    await limpiar();
    for (const j of conCuenta) await base().usuario.create({ data: { nick: j.nombre, clave: "scrypt$prueba$prueba" } });
    const antes4v4 = Object.keys(await EloSalas.tablaSala("4v4")).length;

    await EloSalas.procesarPartido("3v3", { red: [ANA, BETO], blue: [CARO, DANI], ganador: 1, goles: { [ANA.nombre]: 2 } });
    await EloSalas.procesarPartido("3v3", { red: [ANA, CARO], blue: [BETO, DANI], ganador: 1, goles: {} });
    const r = await EloSalas.procesarPartido("realsoccer", { red: [ANA], blue: [BETO], ganador: 2, goles: { [BETO.nombre]: 3 } });

    const s3 = await EloSalas.tablaSala("3v3");
    const rs = await EloSalas.tablaSala("realsoccer");
    const gen = await EloSalas.tablaGeneral();
    revisar("Cada partido queda en la tabla de su sala", s3[clave(ANA)].partidos === 2 && rs[clave(ANA)].partidos === 1, `3v3 ${s3[clave(ANA)].partidos} PJ · RS ${rs[clave(ANA)].partidos} PJ`);
    revisar("Las otras salas no se tocan", Object.keys(await EloSalas.tablaSala("4v4")).length === antes4v4 && !rs[clave(CARO)]);

    const soloNuestras = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => nuestras.includes(k)));
    const js = Elo.calcularGeneral({ "3v3": soloNuestras(s3), realsoccer: soloNuestras(rs) });
    const jugaron = [ANA, BETO, CARO, DANI].map(clave);
    const iguales = jugaron.every((k) => gen[k] && js[k] && gen[k].elo === js[k].elo && gen[k].partidos === js[k].partidos && gen[k].goles === js[k].goles);
    revisar("El procedimiento de la base da lo mismo que la cuenta en Node", iguales, jugaron.map((k) => `${gen[k] && gen[k].elo}/${js[k] && js[k].elo}`).join(" "));
    revisar("ANA: el general es el promedio pesado de sus dos salas", gen[clave(ANA)].elo === Math.round((s3[clave(ANA)].elo * 2 + rs[clave(ANA)].elo) / 3), `3v3 ${s3[clave(ANA)].elo}×2 · RS ${rs[clave(ANA)].elo}×1 → ${gen[clave(ANA)].elo}`);
    revisar("Los goles del general suman los de las salas", gen[clave(BETO)].goles === 3 && gen[clave(ANA)].goles === 2);
    revisar("Devuelve el general de los que jugaron (para las cuentas)", r.enBase && r.general[clave(ANA)] === gen[clave(ANA)].elo);

    const espejoSala = Elo.leerElo("realsoccer");
    const espejoGeneral = Elo.leerElo();
    revisar("Deja los archivos espejo iguales a la base", espejoSala[clave(BETO)] && espejoSala[clave(BETO)].elo === rs[clave(BETO)].elo && espejoGeneral[clave(ANA)].elo === gen[clave(ANA)].elo);

    // Los que no tienen cuenta o no pusieron la clave juegan, pero no quedan en ninguna tabla
    const mixto = await EloSalas.procesarPartido("4v4", { red: [ANA, EMA], blue: [BETO, FEDE], ganador: 1, goles: { [EMA.nombre]: 2 } });
    const t4 = await EloSalas.tablaSala("4v4");
    const gen2 = await EloSalas.tablaGeneral();
    revisar("Sin cuenta no entra a la tabla de la sala ni al general", !t4[clave(EMA)] && !gen2[clave(EMA)]);
    revisar("Con cuenta pero sin !clave tampoco suma", !t4[clave(FEDE)] && !gen2[clave(FEDE)]);
    revisar("Los que sí tienen cuenta suman igual", t4[clave(ANA)] && t4[clave(ANA)].partidos === 1 && t4[clave(BETO)] && mixto.cambios.length === 2, mixto.cambios.map((c) => c.nombre).join(", "));
    revisar("Devuelve a quiénes no se les sumó", mixto.sinCuenta.length === 2 && mixto.sinCuenta.includes(EMA.nombre) && mixto.sinCuenta.includes(FEDE.nombre));

    // Borrar a alguien de todas las salas lo saca del general al recalcular
    await base().$executeRawUnsafe(`DELETE FROM "elo_3v3" WHERE clave = $1`, clave(DANI));
    await EloSalas.actualizarGeneral([clave(DANI)]);
    const sinDani = await EloSalas.tablaGeneral();
    revisar("Si ya no está en ninguna sala, sale del general", !sinDani[clave(DANI)]);
  } finally {
    await limpiar();
  }
  return terminar(cerrarBase);
})().catch(async (error) => {
  console.error(error);
  problemas.push(error.message);
  await terminar(require("../services/ConexionBase").cerrarBase);
});

async function terminar(cerrarBase) {
  await cerrarBase().catch(() => {});
  fs.rmSync(temporal, { recursive: true, force: true });
  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ ELO por sala OK: cada sala su tabla y el general calculado por el procedimiento");
  process.exit(0);
}
