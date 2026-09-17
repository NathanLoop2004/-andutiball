// El arrancador de todo: las 4 salas, y Ñandutí Web (panel + túnel de Cloudflare) si no estaba.
//
//   npm start            todo junto
//   npm start todos      lo mismo (también: todas, todo, all)
//   npm start 4v4        todo, pero con una sola sala (3v3 · 4v4 · futsal · realsoccer)
//
// Cada sala corre en su propio proceso y se cortan juntas con Ctrl+C.
//
// La WEB (panel + túnel) queda prendida APARTE, en segundo plano (ver web.js): así reiniciar
// las salas no cambia el link público. Se apaga con "npm run web:bajar".
//
// Antes de abrir las salas deja todo listo solo (lib/preparar.js): prende la base si está
// apagada (con docker compose, queda aparte y no se corta con Ctrl+C), aplica los cambios de
// las tablas, vuelve a parchar script.js si cambiaron los parches, y si la web ya estaba
// prendida pero cambió su código o el .env, le recarga el panel sin cortar el túnel.
//
// Si algo de eso falla, avisa y arranca igual: nadie se queda sin jugar.

const { spawn } = require("child_process");
const path = require("path");
const { hayBase, cerrarBase, entornoActivo } = require("./services/ConexionBase");
const Web = require("./web");
const Preparar = require("./lib/preparar");

const PANEL_PORT = Number(process.env.PANEL_PORT || 8080);

const TODAS = [
  { clave: "3v3", nombre: "Futsal 3v3", config: "hosts/3v3.json", token: "TOKEN_3V3", puerto: 3001, color: "\x1b[36m" },
  { clave: "4v4", nombre: "Futsal 4v4", config: "hosts/4v4.json", token: "TOKEN_4V4", puerto: 3002, color: "\x1b[35m" },
  { clave: "todos", alias: ["futsal", "auto"], nombre: "Futsal automático", config: "hosts/todos.json", token: "TOKEN_TODOS", puerto: 3003, color: "\x1b[33m" },
  { clave: "realsoccer", nombre: "Real Soccer", config: "hosts/realsoccer.json", token: "TOKEN_REALSOCCER", puerto: 3004, color: "\x1b[32m" },
];

const RESET = "\x1b[0m";
const GRIS = "\x1b[90m";

// Sin argumentos (o con "todos") levanta las 4; con el nombre de una sala, solo esa.
// Ojo: la sala de futsal automático tiene clave "todos" (hosts/todos.json, TOKEN_TODOS), pero
// "npm start todos" levanta las 4, que es lo que espera cualquiera. Esa sala sola: "npm start futsal".
const pedida = (process.argv[2] || "").trim().toLowerCase();
let SALAS = TODAS;
if (pedida && !["todos", "todas", "todo", "all", "4", "cuatro"].includes(pedida)) {
  const una = TODAS.find((s) => s.clave !== "todos" ? s.clave === pedida : (s.alias || []).includes(pedida));
  if (!una) {
    console.error(`\n❌ No existe la sala "${pedida}".`);
    console.error(`   Salas: ${TODAS.map((s) => (s.alias ? s.alias[0] : s.clave)).join(" · ")}`);
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

console.log(`\n🕸️  ÑandutíBall — levantando ${SALAS.length === 1 ? SALAS[0].nombre : "las " + SALAS.length + " salas"}\n`);

// HaxBall devuelve 429 si se crean varias salas al mismo tiempo desde una misma IP.
const RETARDO_ENTRE_SALAS = Number(process.env.RETARDO_ENTRE_SALAS_MS || 8000);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Todo lo que antes había que correr a mano: prender la base, aplicar los cambios de las
// tablas y volver a parchar el script si cambiaron los parches (ver lib/preparar.js)
async function prepararTodo() {
  const ok = await Preparar.prepararBase({ hayBase, cerrarBase });
  await cerrarBase().catch(() => {});
  if (ok) {
    console.log(`🗄️  Base de datos: conectada ${GRIS}(${entornoActivo})${RESET}`);
    Preparar.prepararTablas();
  } else {
    console.log(`   ${GRIS}Sin base: las salas no van a pedir clave y la web no deja entrar${RESET}`);
  }
  Preparar.prepararScript();
  console.log("");
}

// La web (panel + túnel) va aparte y NO se corta con las salas: si ya estaba prendida no se
// toca (el link público sigue igual), y si no, se la deja corriendo en segundo plano.
async function asegurarLaWeb() {
  const e = await Web.estado();
  if (e.prendida || e.panel) {
    const link = Web.linkPublico();
    console.log(`🕸️  Ñandutí Web: ya estaba prendida${link ? ` — el link sigue igual: ${link}` : ""}`);

    // Si cambió el código de la web o el .env, se recarga solo el panel (el túnel no se toca)
    if (e.prendida && Web.firmaDelPanel() !== Web.firmaConLaQueArranco()) {
      console.log(`   🔄 Cambió el código de la web o el .env: recargo el panel ${GRIS}(el link no cambia)${RESET}`);
      const antes = Web.firmaConLaQueArranco();
      Web.pedirRecarga();
      for (let i = 0; i < 40 && Web.firmaConLaQueArranco() === antes; i++) await espera(500);
      for (let i = 0; i < 30 && !(await Web.contestaElPanel()); i++) await espera(500);
      console.log(`   ${(await Web.contestaElPanel()) ? "✅ Panel recargado" : "⚠️ El panel todavía no contesta, mirá " + Web.ARCHIVO_LOG}`);
    } else if (!e.prendida) {
      console.log(`   ${GRIS}(está corriendo en otra terminal: no la puedo recargar sola. Cortala y volvé a correr npm start)${RESET}`);
    }
    console.log("");
    return;
  }
  const pid = Web.prenderEnSegundoPlano();
  console.log(`🕸️  Ñandutí Web: la dejo prendida en segundo plano ${GRIS}(pid ${pid})${RESET}`);
  console.log(`   ${GRIS}No se apaga con Ctrl+C: reiniciar las salas no cambia el link. Para apagarla: npm run web:bajar${RESET}`);
  console.log(`   ${GRIS}Lo que va pasando: ${Web.ARCHIVO_LOG}${RESET}`);

  // Esperamos a que el panel conteste y, si hay túnel, a que salga el link nuevo
  for (let i = 0; i < 30 && !(await Web.contestaElPanel()); i++) await espera(500);
  if (conTunel) {
    const antes = Web.linkPublico();
    for (let i = 0; i < 40; i++) {
      const ahora = Web.linkPublico();
      if (ahora && ahora !== antes) break;
      await espera(500);
    }
  }
  console.log("");
}

(async () => {
  await prepararTodo();

  await asegurarLaWeb();

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
  const link = Web.linkPublico();
  if (link) console.log(`🌐 Link público: ${link}`);
  console.log(`${GRIS}Ctrl+C corta las salas. La web sigue prendida (npm run web:bajar para apagarla)${RESET}\n`);
})();

const cerrarTodo = () => {
  console.log("\n👋 Cerrando todo...");
  for (const hijo of procesos) hijo.kill();
  setTimeout(() => process.exit(0), 1500);
};
process.on("SIGINT", cerrarTodo);
process.on("SIGTERM", cerrarTodo);
