// Guarda una novedad para el Discord, desde la terminal.
//
//   npm run actualizacion -- "Ahora el partido arranca solo con 2 jugadores"
//   npm run actualizacion -- --titulo "Novedades del sábado" "Se agregaron las camisetas de..."
//   npm run actualizacion -- --commit "Ahora el partido arranca solo" 4f2c80b
//   npm run actualizacion -- --enviar                (manda todas las pendientes)
//   npm run actualizacion -- --lista                 (muestra las últimas)
//
// Queda como PENDIENTE: no sale al Discord hasta que alguien le da enviar (en el panel,
// o con --enviar). Se escribe en castellano y a nivel de uso: qué cambia para el que
// juega, sin nombres de archivos ni jerga (ver CLAUDE.md → "Actualizaciones para el Discord").

const ActualizacionModel = require("./models/ActualizacionModel");
const { cerrarBase } = require("./services/ConexionBase");

const args = process.argv.slice(2);
const sacarBandera = (nombre) => {
  const i = args.indexOf(nombre);
  if (i === -1) return null;
  const valor = args[i + 1] && !args[i + 1].startsWith("--") ? args.splice(i, 2)[1] : (args.splice(i, 1), true);
  return valor;
};

const fecha = (d) => new Date(d).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ICONO = { pendiente: "🕗", enviada: "✅", error: "❌" };

(async () => {
  const enviar = Boolean(sacarBandera("--enviar"));
  const lista = Boolean(sacarBandera("--lista"));
  const titulo = sacarBandera("--titulo");
  const esCommit = Boolean(sacarBandera("--commit"));

  if (lista) {
    for (const a of (await ActualizacionModel.listar({ limite: 20 })).reverse()) {
      console.log(`${ICONO[a.estado] || "·"} [${a.id}] ${fecha(a.creada)} ${a.titulo ? "— " + a.titulo : ""}`);
      console.log(`   ${a.mensaje.split("\n").join("\n   ")}`);
      if (a.error) console.log(`   ⚠️ ${a.error}`);
    }
    return;
  }

  const mensaje = args.filter((a) => !a.startsWith("--")).join(" ").trim();

  if (mensaje) {
    const guardada = await ActualizacionModel.crear({
      mensaje,
      titulo: typeof titulo === "string" ? titulo : null,
      origen: esCommit ? "commit" : "manual",
      commit: esCommit ? await hashDelUltimoCommit() : null,
    });
    console.log(`🕗 Guardada como pendiente [${guardada.id}]`);
    console.log(`   ${guardada.mensaje}`);
    if (!enviar) console.log("   👉 Revisala y mandala desde el panel (Actualizaciones) o con: npm run actualizacion -- --enviar");
  }

  if (enviar) {
    const { enviadas, fallaron, errores } = await ActualizacionModel.enviarPendientes();
    console.log(`📣 Enviadas al Discord: ${enviadas}${fallaron ? ` · fallaron: ${fallaron}` : ""}`);
    for (const e of errores) console.log(`   ❌ [${e.id}] ${e.error}`);
    if (fallaron) process.exitCode = 1;
  }

  if (!mensaje && !enviar) {
    console.log('Uso:  npm run actualizacion -- "qué cambió, contado para el que juega"');
    console.log("      npm run actualizacion -- --lista | --enviar");
  }
})()
  .catch((error) => {
    console.error("❌ " + error.message);
    process.exitCode = 1;
  })
  .finally(() => cerrarBase().catch(() => {}));

// El hash queda solo como referencia nuestra: al Discord nunca se manda
async function hashDelUltimoCommit() {
  try {
    const { execFileSync } = require("child_process");
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
