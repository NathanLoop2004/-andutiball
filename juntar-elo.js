// Junta las filas repetidas del ELO en una sola por CUENTA.
//
//   npm run elo:juntar          (muestra lo que haría, sin tocar nada)
//   npm run elo:juntar -- --si  (lo hace)
//
// Por qué: el ELO iba por el auth de HaxBall, y HaxBall da un auth distinto por navegador o
// dispositivo, así que la misma persona quedaba con varias filas ("rj" tenía 3). Ahora la clave
// es "cuenta:<nick>" (ver lib/elo.js).
//
//   · Las filas de una misma cuenta se juntan: el ELO es el promedio pesado por partidos (la misma
//     cuenta que hace el procedimiento del general) y lo demás se suma.
//   · Las filas de gente SIN cuenta en la web se borran: al ELO ya solo entran los que tienen
//     cuenta y ponen su clave.
//   · Antes de tocar nada, se guarda un respaldo en datos/respaldo-elo-<fecha>.json.

const fs = require("fs");
const path = require("path");
const { base, cerrarBase } = require("./services/ConexionBase");
const EloSalasModel = require("./models/EloSalasModel");

const TABLAS = { ...EloSalasModel.TABLAS, general: "elo_general" };
const enSerio = process.argv.includes("--si");

const juntar = (filas) => {
  let suma = 0;
  const total = { partidos: 0, ganados: 0, empatados: 0, perdidos: 0, goles: 0 };
  let actualizado = new Date(0);
  let nombre = filas[0].nombre;
  for (const f of filas) {
    suma += (f.elo || 0) * (f.partidos || 0);
    for (const c of Object.keys(total)) total[c] += f[c] || 0;
    if (new Date(f.actualizado) >= actualizado) { actualizado = new Date(f.actualizado); nombre = f.nombre; }
  }
  return { ...total, nombre, elo: total.partidos > 0 ? Math.round(suma / total.partidos) : 1000, actualizado };
};

(async () => {
  const usuarios = await base().usuario.findMany({ where: { NOT: { clave: null } }, select: { nick: true } });
  const cuentas = new Map(usuarios.map((u) => [u.nick.trim().toLowerCase(), u.nick]));
  console.log(`👤 ${cuentas.size} cuentas con clave en la web\n`);

  const respaldo = {};
  for (const [sala, tabla] of Object.entries(TABLAS)) {
    const filas = await base().$queryRawUnsafe(`SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "${tabla}"`);
    respaldo[tabla] = filas;

    const porCuenta = new Map();   // nick en minúscula → filas
    const sinCuenta = [];
    for (const f of filas) {
      const nombre = String(f.nombre || "").trim().toLowerCase();
      if (cuentas.has(nombre)) {
        if (!porCuenta.has(nombre)) porCuenta.set(nombre, []);
        porCuenta.get(nombre).push(f);
      } else {
        sinCuenta.push(f);
      }
    }

    const repetidas = [...porCuenta.entries()].filter(([, f]) => f.length > 1);
    console.log(`📊 ${tabla}: ${filas.length} filas → ${porCuenta.size} cuentas` +
      (repetidas.length ? `, ${repetidas.length} con filas repetidas` : "") +
      (sinCuenta.length ? `, ${sinCuenta.length} sin cuenta (se borran)` : ""));
    for (const [nick, f] of repetidas) {
      console.log(`   · ${cuentas.get(nick)}: ${f.length} filas (${f.map((x) => x.elo + " en " + x.partidos + "PJ").join(" + ")}) → ${juntar(f).elo}`);
    }

    if (!enSerio) continue;

    await base().$executeRawUnsafe(`DELETE FROM "${tabla}"`);
    for (const [nick, f] of porCuenta) {
      const j = juntar(f);
      await base().$executeRawUnsafe(
        `INSERT INTO "${tabla}" (clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        "cuenta:" + nick, cuentas.get(nick), j.elo, j.partidos, j.ganados, j.empatados, j.perdidos, j.goles, j.actualizado
      );
    }
  }

  const archivo = path.join(__dirname, "datos", `respaldo-elo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
  console.log(`\n💾 Respaldo de cómo estaba: ${path.relative(__dirname, archivo)}`);

  if (!enSerio) {
    console.log("\n👉 Esto fue una pasada en seco. Para hacerlo:  npm run elo:juntar -- --si");
    return cerrarBase();
  }

  await EloSalasModel.actualizarGeneral();
  await EloSalasModel.espejar();
  console.log("\n✅ Listo: una fila por cuenta, general recalculado y archivos espejo al día.");
  return cerrarBase();
})().catch(async (error) => {
  console.error("❌", error.message);
  await cerrarBase().catch(() => {});
  process.exit(1);
});
