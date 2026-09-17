// Prueba la base de datos: que el enrutado por entorno elija bien y que las tablas
// de Prisma anden.
//
//   npm run base            levanta Postgres
//   npm run base:migrar     crea las tablas
//   npm run prueba-base
//
// Si la base no está levantada NO falla: avisa y sale bien. La base todavía es
// opcional — el host y el panel funcionan sin ella.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// Corre un pedacito de código en otro proceso, con las variables que le pasemos
const enOtroProceso = (codigo, env) => {
  try {
    return { ok: true, salida: execFileSync(process.execPath, ["-e", codigo], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    return { ok: false, salida: String(error.stderr || error.message).trim() };
  }
};

(async () => {
  console.log("🗄️  Enrutado por entorno (services/ConexionBase.js):\n");

  const { entornoActivo, ENTORNOS, base, hayBase, cerrarBase } = require("../services/ConexionBase");

  revisar("Hay un archivo de conexión por entorno", Object.values(ENTORNOS).every((r) => fs.existsSync(path.join(RAIZ, "services", r.replace("./", "") + ".js"))), Object.keys(ENTORNOS).join(" · "));

  const sinDbEnv = enOtroProceso("console.log(require('./services/ConexionBase').entornoActivo)", { DB_ENV: "" });
  revisar("Sin DB_ENV usa desarrollo", sinDbEnv.ok && sinDbEnv.salida === "desarrollo", sinDbEnv.salida);

  const testing = enOtroProceso("console.log(require('./services/ConexionBase').entornoActivo)", { DB_ENV: "testing" });
  revisar("DB_ENV=testing elige testing", testing.ok && testing.salida === "testing", testing.salida);

  const roto = enOtroProceso("require('./services/ConexionBase')", { DB_ENV: "la_de_mi_primo" });
  revisar("Un DB_ENV inventado avisa y corta", !roto.ok && /DB_ENV no válido/.test(roto.salida), (roto.salida.split("\n").find((l) => l.includes("DB_ENV")) || roto.salida).slice(0, 80));

  const cargadas = enOtroProceso(
    "require('./services/ConexionBase').base(); const m = Object.keys(require.cache).filter(k => k.includes('ConexionPostgres')).map(k => k.split(/[\\\\/]/).pop()); console.log(m.join(','))",
    { DB_ENV: "desarrollo", DB_DESARROLLO_URL: "postgresql://postgres:postgres@localhost:5432/nandutiball" }
  );
  revisar("Solo se abre la conexión del entorno activo", cargadas.ok && cargadas.salida === "ConexionPostgresDesarrollo.js", cargadas.salida.split("\n").pop());

  console.log("\n📐 El esquema de Prisma:\n");
  let validacion = { ok: true };
  try {
    execFileSync(process.execPath, [path.join(RAIZ, "node_modules", "prisma", "build", "index.js"), "validate"], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    validacion = { ok: false, salida: String(error.stdout || error.stderr || "").trim() };
  }
  revisar("prisma/schema.prisma es válido", validacion.ok, validacion.ok ? "" : validacion.salida.split("\n").slice(-3).join(" "));

  const esquema = fs.readFileSync(path.join(RAIZ, "prisma", "schema.prisma"), "utf8");
  revisar("Están las tablas que esperamos", ["usuarios", "salas", "partidos", "participaciones", "rangos"].every((t) => esquema.includes(`@@map("${t}")`)), "usuarios · salas · partidos · participaciones · rangos");

  console.log("\n🔌 La base de verdad (" + entornoActivo + "):\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  No está levantada, salteamos las pruebas de tablas.");
    console.log("      👉 npm run base   y después   npm run base:migrar\n");
    await cerrarBase().catch(() => {});
    if (problemas.length) {
      console.log("❌ Falló: " + problemas.join(" | "));
      process.exit(1);
    }
    console.log("✅ Enrutado por entorno y esquema OK (la base no estaba levantada)");
    return;
  }

  const db = base();
  const nick = "PruebaNanduti" + Date.now();
  try {
    const creado = await db.usuario.create({ data: { auth: "auth-" + nick, nick, elo: 1234 } });
    revisar("Se puede grabar un usuario", creado.id > 0 && creado.elo === 1234, "id " + creado.id);

    const leido = await db.usuario.findUnique({ where: { auth: "auth-" + nick } });
    revisar("Y volver a leerlo por su auth", Boolean(leido) && leido.nick === nick, leido ? leido.nick : "no se encontró");

    await db.usuario.delete({ where: { id: creado.id } });
    const borrado = await db.usuario.findUnique({ where: { id: creado.id } });
    revisar("Y borrarlo", borrado === null);

    // Un partido terminado: crea el partido y suma a los que TIENEN CUENTA (con clave).
    // Al que no tiene cuenta no se le crea nada: su puntaje queda solo en elo.json.
    const PartidoModel = require("../models/PartidoModel");
    const { aplicarPartido } = require("../lib/elo");
    const claves = require("../lib/claves");
    const rojo = nick + "R", azul = nick + "B", sinCuenta = nick + "X";
    await db.usuario.create({ data: { nick: rojo, auth: "auth-" + rojo, clave: claves.hashear("clave1234") } });
    await db.usuario.create({ data: { nick: azul, clave: claves.hashear("clave1234") } });
    const evento = { red: [{ nombre: rojo, auth: "auth-" + rojo }], blue: [{ nombre: azul, auth: null }, { nombre: sinCuenta, auth: "auth-" + sinCuenta }], ganador: 1, golesRed: 3, golesBlue: 1, mapa: "Futsal x3", goles: { [rojo]: 2 } };
    const partido = await PartidoModel.guardar(evento, aplicarPartido({}, evento), { clave: "prueba-" + nick, nombre: "Prueba" });
    try {
      const ganador = await db.usuario.findUnique({ where: { nick: rojo } });
      const perdedor = await db.usuario.findUnique({ where: { nick: azul } });
      const participaciones = await db.participacion.count({ where: { partidoId: partido.id } });
      revisar("Un partido terminado se guarda", partido.golesRed === 3 && partido.ganador === 1 && participaciones === 2, "partido #" + partido.id);
      revisar("Al que gana le suma ELO, partido, victoria y goles", ganador && ganador.elo > 1000 && ganador.partidos === 1 && ganador.ganados === 1 && ganador.goles === 2);
      revisar("Al que pierde le resta ELO y le anota la derrota", perdedor && perdedor.elo < 1000 && perdedor.perdidos === 1);
      const creadoSolo = await db.usuario.findUnique({ where: { nick: sinCuenta } });
      revisar("Al que jugó sin cuenta NO se le crea un usuario", creadoSolo === null, creadoSolo ? "se creó" : "no se creó");
    } finally {
      await db.partido.delete({ where: { id: partido.id } });
      await db.usuario.deleteMany({ where: { nick: { in: [rojo, azul, sinCuenta] } } });
      await db.sala.delete({ where: { clave: "prueba-" + nick } });
    }
  } catch (error) {
    revisar("Las tablas están creadas", false, error.message.split("\n")[0]);
    console.log("      👉 Corré: npm run base:migrar");
  }
  await cerrarBase().catch(() => {});

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Base OK: entorno " + entornoActivo + ", esquema válido y tablas andando");
})();
