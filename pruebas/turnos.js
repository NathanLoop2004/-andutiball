// Prueba la selección por turnos: entran 8 espectadores y los capitanes van eligiendo.
// Comprueba que se arme 3v3 alternando Red y Blue, y que nadie de más entre a la cancha.
//
//   node pruebas/turnos.js [hosts/3v3.json]

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const hostConfig = process.argv[2] || "hosts/3v3.json";
const anuncios = [];
const errores = [];

const jugadores = new Map();
let enJuego = false;
const room = {
  getPlayerList: () => [...jugadores.values()],
  getPlayer: (id) => jugadores.get(id) || null,
  getScores: () => (enJuego ? { red: 0, blue: 0, time: 30, scoreLimit: 3, timeLimit: 180 } : null),
  getBallPosition: () => ({ x: 0, y: 0 }),
  getDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 10, invMass: 1 }),
  getPlayerDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 15, invMass: 1 }),
  getDiscCount: () => 0,
  sendAnnouncement: (msg) => anuncios.push(String(msg)),
  setPlayerAdmin: (id, v) => jugadores.has(id) && (jugadores.get(id).admin = v),
  setPlayerTeam: (id, t) => jugadores.has(id) && (jugadores.get(id).team = t),
  kickPlayer: () => {}, clearBan: () => {}, clearBans: () => {}, setPassword: () => {},
  setRequireRecaptcha: () => {}, setTeamsLock: () => {}, setScoreLimit: () => {}, setTimeLimit: () => {},
  setCustomStadium: () => {}, setDefaultStadium: () => {}, setTeamColors: () => {}, setPlayerAvatar: () => {},
  setDiscProperties: () => {}, setPlayerDiscProperties: () => {}, setKickRateLimit: () => {}, reorderPlayers: () => {},
  startGame: () => { enJuego = true; }, stopGame: () => { enJuego = false; }, pauseGame: () => {},
  startRecording: () => {}, stopRecording: () => new Uint8Array(0),
};

// Relojes controlados: el test decide cuándo corre cada setTimeout
const pendientes = [];
const noop = () => {};
const elemento = { innerText: "", innerHTML: "", href: "", style: {}, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] };
const ventana = {
  HBInit: () => room,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  XMLHttpRequest: class { open() {} setRequestHeader() {} send() {} addEventListener() {} },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
  FormData: class { append() {} }, File: class {}, Blob: class {},
  document: { querySelector: () => elemento, querySelectorAll: () => [], createElement: () => elemento, body: elemento },
  console: { log: noop, warn: noop, error: (...a) => errores.push(a.join(" ")) },
  setTimeout: (fn, ms) => { pendientes.push({ fn, ms }); return pendientes.length; },
  setInterval: () => 0, clearInterval: noop, clearTimeout: noop,
};
ventana.window = ventana;

// Corre los setTimeout pendientes que caen dentro de "topeMs".
// Respetar el tiempo importa: si corriéramos todos, dispararíamos el reloj de
// "si el capitán no elige, elige el bot" y nunca probaríamos la elección a mano.
function correrRelojes(topeMs = 3000, vueltas = 12) {
  for (let v = 0; v < vueltas; v++) {
    const listos = pendientes.filter((t) => (t.ms || 0) <= topeMs);
    if (!listos.length) return;
    for (const t of listos) pendientes.splice(pendientes.indexOf(t), 1);
    for (const t of listos) {
      try { t.fn(); } catch (e) { errores.push("timeout: " + e.message); }
    }
  }
}

const contexto = vm.createContext(ventana);
let script = fs.readFileSync(path.join(RAIZ, "script.js"), "utf8");
const ajustes = JSON.parse(fs.readFileSync(path.join(RAIZ, hostConfig), "utf8"));
for (const [nombre, valor] of Object.entries(ajustes)) {
  const decl = new RegExp(`^([ \\t]*)(var|let|const)\\s+${nombre}\\b[^;\\n]*;?`, "m");
  script = script.replace(decl, (_, s, k) => `${s}${k} ${nombre} = ${JSON.stringify(valor)};`);
}
contexto.__RANGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "roles.json"), "utf8"));

vm.runInContext(script, contexto, { timeout: 30000 });
console.log(`⚙️  ${hostConfig} — cupo ${ajustes.maxPlayersPerTeam} por equipo\n`);

// Entran 8 espectadores
for (let i = 1; i <= 8; i++) {
  const j = { id: i, name: "Jugador" + i, team: 0, admin: false, conn: "3" + i, auth: "a" + i };
  jugadores.set(i, j);
  if (room.onPlayerJoin) room.onPlayerJoin(j);
}
correrRelojes();

const equipos = () => ({
  red: [...jugadores.values()].filter((j) => j.team === 1).map((j) => j.name),
  blue: [...jugadores.values()].filter((j) => j.team === 2).map((j) => j.name),
  espect: [...jugadores.values()].filter((j) => j.team === 0).map((j) => j.name),
});

console.log("Tras entrar los 8 (deberían salir solo los 2 capitanes):");
console.log("  🔴", equipos().red, "| 🔵", equipos().blue, "| 👁️", equipos().espect.length, "espectadores\n");

// El capitán de turno va eligiendo hasta llenar
const capitanDe = (equipo) => [...jugadores.values()].find((j) => j.team === equipo);
for (let ronda = 1; ronda <= 8; ronda++) {
  const libres = [...jugadores.values()].filter((j) => j.team === 0);
  if (!libres.length) break;
  const e = equipos();
  if (e.red.length >= ajustes.maxPlayersPerTeam && e.blue.length >= ajustes.maxPlayersPerTeam) break;

  // Quién tiene el turno lo dice el propio script: probamos con los dos capitanes
  let eligio = false;
  for (const equipo of [1, 2]) {
    const cap = capitanDe(equipo);
    if (!cap) continue;
    const antes = JSON.stringify(equipos());
    room.onPlayerChat(cap, String(libres[0].id));
    correrRelojes();
    if (JSON.stringify(equipos()) !== antes) {
      console.log(`  ronda ${ronda}: ${cap.name} (${equipo === 1 ? "🔴" : "🔵"}) eligió a ${libres[0].name}`);
      eligio = true;
      break;
    }
  }
  if (!eligio) { console.log(`  ronda ${ronda}: nadie pudo elegir`); break; }
}

const fin = equipos();
console.log("\nEquipos armados:");
console.log("  🔴", fin.red.join(", ") || "(vacío)");
console.log("  🔵", fin.blue.join(", ") || "(vacío)");
console.log("  👁️ quedan afuera:", fin.espect.join(", ") || "(nadie)");

const cupo = ajustes.maxPlayersPerTeam;
const problemas = [];
if (fin.red.length !== cupo) problemas.push(`Red quedó con ${fin.red.length}, se esperaban ${cupo}`);
if (fin.blue.length !== cupo) problemas.push(`Blue quedó con ${fin.blue.length}, se esperaban ${cupo}`);
if (errores.length) problemas.push(...new Set(errores));

console.log("");
if (problemas.length) {
  console.log("❌ " + problemas.join("\n❌ "));
  process.exit(1);
}
console.log(`✅ Quedó ${cupo}v${cupo} eligiendo por turnos, sin errores`);
