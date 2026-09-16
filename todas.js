// El arrancador de todo: Ñandutí Web, el panel, las 4 salas y el túnel de Cloudflare.
//
//   npm start            todo junto
//   npm start 4v4        todo, pero con una sola sala (3v3 · 4v4 · todos · realsoccer)
//
// Cada cosa corre en su propio proceso y todo se corta junto con Ctrl+C.
//
// La BASE DE DATOS va aparte, a propósito: tiene su compose y su propio ciclo de vida
// (los datos no se apagan con las salas).
//
//   npm run base         levanta Postgres
//   npm run base:migrar  crea o actualiza las tablas
//
// Si la base no está levantada, igual arranca todo: la sala no pide claves y la web no
// deja entrar, pero nadie se queda sin jugar.

const { spawn } = require("child_process");
const path = require("path");
const { hayBase, cerrarBase, entornoActivo } = require("./services/ConexionBase");

const PANEL_PORT = Number(process.env.PANEL_PORT || 8080);

const TODAS = [
  { clave: "3v3", nombre: "Futsal 3v3", config: "hosts/3v3.json", token: "TOKEN_3V3", puerto: 3001, color: "\x1b[36m" },
  { clave: "4v4", nombre: "Futsal 4v4", config: "hosts/4v4.json", token: "TOKEN_4V4", puerto: 3002, color: "\x1b[35m" },
  { clave: "todos", nombre: "Futsal automático", config: "hosts/todos.json", token: "TOKEN_TODOS", puerto: 3003, color: "\x1b[33m" },
  { clave: "realsoccer", nombre: "Real Soccer", config: "hosts/realsoccer.json", token: "TOKEN_REALSOCCER", puerto: 3004, color: "\x1b[32m" },
];

const RESET = "\x1b[0m";
const GRIS = "\x1b[90m";

// Sin argumentos levanta las 4; con el nombre de una sala, solo esa
const pedida = (process.argv[2] || "").trim().toLowerCase();
let SALAS = TODAS;
if (pedida && !["todas", "todo", "all", "4", "cuatro"].includes(pedida)) {
  const una = TODAS.find((s) => s.clave === pedida);
  if (!una) {
    console.error(`\n❌ No existe la sala "${pedida}".`);
    console.error(`   Salas: ${TODAS.map((s) => s.clave).join(" · ")}`);
    console.error("   👉 Sin nombre levanta las 4:  npm start\n");
    process.exit(1);
  }
  SALAS = [una];
}

// ── Comprobamos los tokens antes de arrancar nada ──
const sinToken = SALAS.filter((s) => !process.env[s.token]);
if (sinToken.length) {
  console.error(`\n❌ Faltan tokens en .env: ${sinToken.map((s) => s.token).join(", ")}`);
  console.error("   👉 Corré primero:  npm run tokens" + (SALAS.length === 1 ? " -- --una" : "") + "\n");
  process.exit(1);
}

const procesos = [];

function lanzar(nombre, color, archivo, variables) {
  const hijo = spawn(process.execPath, [path.join(__dirname, archivo)], {
    env: { ...process.env, ...variables },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const mostrar = (datos) => {
    for (const linea of String(datos).split("\n")) {
      if (linea.trim()) console.log(`${color}[${nombre}]${RESET} ${linea}`);
    }
  };
  hijo.stdout.on("data", mostrar);
  hijo.stderr.on("data", mostrar);
  hijo.on("exit", (codigo) => console.log(`${color}[${nombre}]${RESET} ${GRIS}terminó (código ${codigo})${RESET}`));

  procesos.push(hijo);
  return hijo;
}

// El túnel viene prendido; se apaga con TUNEL_WEB=no en .env
const conTunel = !/^(no|false|0)$/i.test(String(process.env.TUNEL_WEB ?? "si").trim());

console.log(`\n🕸️  ÑandutíBall — levantando ${SALAS.length === 1 ? SALAS[0].nombre : "las " + SALAS.length + " salas"}, la web${conTunel ? ", el túnel" : ""} y el panel\n`);

// HaxBall devuelve 429 si se crean varias salas al mismo tiempo desde una misma IP.
const RETARDO_ENTRE_SALAS = Number(process.env.RETARDO_ENTRE_SALAS_MS || 8000);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// La base va aparte: acá solo miramos cómo está y lo decimos
async function mirarLaBase() {
  const ok = await hayBase().catch(() => false);
  await cerrarBase().catch(() => {});
  if (ok) {
    console.log(`🗄️  Base de datos: conectada ${GRIS}(${entornoActivo})${RESET}`);
  } else {
    console.log(`🗄️  Base de datos: ${GRIS}apagada — las salas no van a pedir clave y la web no deja entrar${RESET}`);
    console.log(`   ${GRIS}👉 Para levantarla, en otra terminal:  npm run base${RESET}`);
  }
  console.log("");
}

(async () => {
  await mirarLaBase();

  lanzar("panel", "\x1b[34m", "panel/server.js", {
    PANEL_PORT: String(PANEL_PORT),
    SALAS: SALAS.map((s) => `${s.clave}|${s.nombre}|http://localhost:${s.puerto}`).join(","),
  });

  // El túnel de Cloudflare saca la web afuera de localhost y avisa el link en el Discord
  // (un solo mensaje, que se va actualizando). Se apaga con TUNEL_WEB=no en .env.
  if (conTunel) {
    lanzar("tunel", "\x1b[36m", "tunel.js", { TUNEL_PUERTO: String(PANEL_PORT) });
  }

  for (let i = 0; i < SALAS.length; i++) {
    const sala = SALAS[i];
    lanzar(sala.nombre, sala.color, "launcher.js", {
      HOST_CONFIG: sala.config,
      HAXBALL_TOKEN: process.env[sala.token],
      API_PORT: String(sala.puerto),
      ROOM_NAME: sala.nombre,
    });
    if (i < SALAS.length - 1) {
      console.log(`${GRIS}⏳ Esperando ${RETARDO_ENTRE_SALAS / 1000}s para no gatillar el rate-limit de HaxBall...${RESET}`);
      await espera(RETARDO_ENTRE_SALAS);
    }
  }

  console.log(`\n${GRIS}Los links de las salas van a ir apareciendo acá abajo.${RESET}`);
  console.log(`🕸️  Ñandutí Web: http://localhost:${PANEL_PORT}`);
  console.log(`🖥️  Panel (admins): http://localhost:${PANEL_PORT}/frm/panel`);
  if (conTunel) console.log(`${GRIS}🌐 El link público va a salir acá abajo, y se avisa en el Discord${RESET}`);
  console.log(`${GRIS}Cortá todo con Ctrl+C${RESET}\n`);
})();

const cerrarTodo = () => {
  console.log("\n👋 Cerrando todo...");
  for (const hijo of procesos) hijo.kill();
  setTimeout(() => process.exit(0), 1500);
};
process.on("SIGINT", cerrarTodo);
process.on("SIGTERM", cerrarTodo);
