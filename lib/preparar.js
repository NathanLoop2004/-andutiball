// Lo que "npm start" deja listo solo, antes de abrir las salas, para no tener que acordarse de
// correr nada a mano:
//
//   1. la base de datos     → si está apagada, la prende (docker compose, queda aparte)
//   2. las tablas           → aplica las migraciones nuevas (migrate deploy) y regenera el
//                             cliente de Prisma si cambió el schema
//   3. el script de la sala → si se tocó algo en parches/ o mapas/, vuelve a parchar script.js
//
// Nada de esto borra datos: migrate deploy solo aplica migraciones que todavía no corrieron, y
// si algo falla se avisa y se sigue (las salas andan igual sin base).
//
// La web tiene su parte en web.js (firmaDelPanel / pedirRecarga): si cambió su código o el .env,
// se recarga el panel sin cortar el túnel, así el link público no cambia.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const DATOS = path.join(RAIZ, "datos");
const PRISMA = path.join(RAIZ, "node_modules", "prisma", "build", "index.js");
const GRIS = "\x1b[90m";
const RESET = "\x1b[0m";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function correr(comando, argumentos, ms = 180000) {
  const r = spawnSync(comando, argumentos, { cwd: RAIZ, env: process.env, encoding: "utf8", timeout: ms, windowsHide: true });
  return { ok: r.status === 0, salida: ((r.stdout || "") + (r.stderr || "")).trim(), error: r.error };
}

const primeraLinea = (texto) => String(texto || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-1)[0] || "";

// El último cambio (mtime) de todos los archivos de una carpeta, recorriéndola entera
function ultimoCambio(ruta) {
  let mayor = 0;
  try {
    const info = fs.statSync(ruta);
    if (!info.isDirectory()) return info.mtimeMs;
    for (const nombre of fs.readdirSync(ruta)) mayor = Math.max(mayor, ultimoCambio(path.join(ruta, nombre)));
  } catch (error) { /* no existe */ }
  return mayor;
}

function hashDeArchivo(ruta) {
  try { return crypto.createHash("sha1").update(fs.readFileSync(ruta)).digest("hex"); } catch (error) { return ""; }
}

// ── 1. La base ──
async function prepararBase({ hayBase, cerrarBase }) {
  if (await hayBase().catch(() => false)) return true;

  const docker = correr("docker", ["--version"], 15000);
  if (!docker.ok) {
    console.log(`🗄️  Base de datos: apagada, y no encuentro Docker para prenderla ${GRIS}(las salas andan igual)${RESET}`);
    return false;
  }

  console.log("🗄️  Base de datos: apagada — la prendo (queda prendida aparte, no se corta con Ctrl+C)…");
  const arriba = correr("docker", ["compose", "-f", "docker-compose.base.yml", "up", "-d"], 180000);
  if (!arriba.ok) {
    console.log(`   ⚠️ No se pudo: ${primeraLinea(arriba.salida) || (arriba.error && arriba.error.message)}`);
    console.log(`   ${GRIS}¿Docker Desktop está abierto? Las salas arrancan igual, sin base.${RESET}`);
    return false;
  }

  // Postgres tarda unos segundos en aceptar conexiones
  for (let i = 0; i < 40; i++) {
    await cerrarBase().catch(() => {});
    if (await hayBase().catch(() => false)) return true;
    await espera(1000);
  }
  console.log("   ⚠️ El contenedor arrancó pero la base no contesta todavía. Las salas arrancan igual.");
  return false;
}

// ── 2. Las tablas ──
function prepararTablas() {
  if (!fs.existsSync(PRISMA)) return;

  const migrar = correr(process.execPath, [PRISMA, "migrate", "deploy"]);
  if (!migrar.ok) {
    console.log(`   ⚠️ No se pudieron aplicar los cambios de las tablas: ${primeraLinea(migrar.salida)}`);
    console.log(`   ${GRIS}👉 Mirá el detalle con: node --env-file-if-exists=.env node_modules/prisma/build/index.js migrate deploy${RESET}`);
  } else {
    // Cada migración sale como "└─ 20260917120000_nombre/" (y abajo su migration.sql, que no cuenta)
    const aplicadas = (migrar.salida.match(/└─\s*\d{14}_/g) || []).length;
    const nuevas = /No pending migrations/i.test(migrar.salida) ? 0 : aplicadas;
    console.log(`   📐 Tablas al día${nuevas ? ` — apliqué ${nuevas} cambio(s) nuevo(s)` : ""}`);
  }

  // El cliente de Prisma se regenera solo si cambió el schema (o nunca se generó)
  const firma = hashDeArchivo(path.join(RAIZ, "prisma", "schema.prisma"));
  const archivoFirma = path.join(DATOS, "prisma.firma");
  const anterior = fs.existsSync(archivoFirma) ? fs.readFileSync(archivoFirma, "utf8").trim() : "";
  const hayCliente = fs.existsSync(path.join(RAIZ, "node_modules", ".prisma", "client"));
  if (firma && (firma !== anterior || !hayCliente)) {
    const generar = correr(process.execPath, [PRISMA, "generate"]);
    if (generar.ok) {
      fs.mkdirSync(DATOS, { recursive: true });
      fs.writeFileSync(archivoFirma, firma);
      console.log("   🔧 Cliente de la base regenerado (cambió el schema)");
    } else {
      console.log(`   ⚠️ No se pudo regenerar el cliente de la base: ${primeraLinea(generar.salida)}`);
    }
  }
}

// ── 3. El script de la sala ──
function prepararScript() {
  const script = path.join(RAIZ, "script.js");
  const cambios = Math.max(ultimoCambio(path.join(RAIZ, "parches")), ultimoCambio(path.join(RAIZ, "mapas")));
  if (!fs.existsSync(script) || cambios <= fs.statSync(script).mtimeMs) return;

  console.log("🧩 Cambiaron los parches: vuelvo a parchar script.js…");
  const parchar = correr(process.execPath, [path.join(RAIZ, "parches", "aplicar.js")]);
  const check = parchar.ok ? correr(process.execPath, ["--check", script]) : { ok: false };
  if (parchar.ok && check.ok) {
    console.log("   ✅ script.js actualizado");
    return;
  }
  console.log(`   ⚠️ No se pudo parchar: ${primeraLinea(parchar.salida || check.salida)}`);
  console.log(`   ${GRIS}Las salas arrancan con el script.js que había. 👉 npm run parchar para ver el detalle${RESET}`);
  // Si quedó roto, se vuelve al anterior
  const anterior = path.join(RAIZ, "script.anterior.js");
  if (!check.ok && fs.existsSync(anterior) && !correr(process.execPath, ["--check", script]).ok) {
    fs.copyFileSync(anterior, script);
    console.log(`   ${GRIS}(volví a dejar el script.js anterior)${RESET}`);
  }
}

module.exports = { prepararBase, prepararTablas, prepararScript, ultimoCambio };
