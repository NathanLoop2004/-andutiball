// Comprueba que el nombre en el chat salga con el color de su división de ELO,
// sin romper lo que ya hacía el script (prefijos de rango, mute, comandos).
//
//   node pruebas/color-chat.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");

// Tabla propia, para no depender de la de verdad ni pisarla
const os = require("os");
const ARCHIVO_PRUEBA = path.join(os.tmpdir(), "elo-color-" + Date.now() + ".json");
process.env.ELO_FILE = ARCHIVO_PRUEBA;
const elo = require("../lib/elo");
{
  const tabla = {};
  for (const [nombre, puntaje] of [["Jinder", 1620], ["Novato", 850]]) {
    const f = elo.fichaDe(tabla, { nombre, auth: "a" + nombre });
    f.elo = puntaje;
    f.partidos = 20;
  }
  elo.guardarElo(tabla);
}

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
  sendAnnouncement: (msg, id, color, estilo, sonido) => anuncios.push({ msg: String(msg), id, color }),
  setPlayerAdmin: (id, v) => jugadores.has(id) && (jugadores.get(id).admin = v),
  setPlayerTeam: (id, t) => jugadores.has(id) && (jugadores.get(id).team = t),
  kickPlayer: () => {}, clearBan: () => {}, clearBans: () => {}, setPassword: () => {},
  setRequireRecaptcha: () => {}, setTeamsLock: () => {}, setScoreLimit: () => {}, setTimeLimit: () => {},
  setCustomStadium: () => {}, setDefaultStadium: () => {}, setTeamColors: () => {}, setPlayerAvatar: () => {},
  setDiscProperties: () => {}, setPlayerDiscProperties: () => {}, setKickRateLimit: () => {}, reorderPlayers: () => {},
  startGame: () => { enJuego = true; }, stopGame: () => { enJuego = false; }, pauseGame: () => {},
  startRecording: () => {}, stopRecording: () => new Uint8Array(0),
};

const pendientes = [];
const noop = () => {};
const el = { innerText: "", innerHTML: "", href: "", style: {}, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] };
const ventana = {
  HBInit: () => room,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  XMLHttpRequest: class { open() {} setRequestHeader() {} send() {} addEventListener() {} },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
  FormData: class { append() {} }, File: class {}, Blob: class {},
  document: { querySelector: () => el, querySelectorAll: () => [], createElement: () => el, body: el },
  console: { log: noop, warn: noop, error: (...a) => errores.push(a.join(" ")) },
  setTimeout: (fn, ms) => { pendientes.push({ fn, ms }); return pendientes.length; },
  setInterval: () => 0, clearInterval: noop, clearTimeout: noop,
};
ventana.window = ventana;
const correr = (tope = 3000) => {
  for (let v = 0; v < 8; v++) {
    const listos = pendientes.filter((t) => (t.ms || 0) <= tope);
    if (!listos.length) return;
    for (const t of listos) pendientes.splice(pendientes.indexOf(t), 1);
    for (const t of listos) { try { t.fn(); } catch (e) { errores.push("timeout: " + e.message); } }
  }
};

const contexto = vm.createContext(ventana);
let script = fs.readFileSync(path.join(RAIZ, "script.js"), "utf8");
const ajustes = JSON.parse(fs.readFileSync(path.join(RAIZ, "hosts/todos.json"), "utf8"));
for (const [n, v] of Object.entries(ajustes)) {
  const d = new RegExp(`^([ \\t]*)(var|let|const)\\s+${n}\\b[^;\\n]*;?`, "m");
  script = script.replace(d, (_, s, k) => `${s}${k} ${n} = ${JSON.stringify(v)};`);
}
contexto.__RANGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "roles.json"), "utf8"));
contexto.__ELO = elo.paraLaSala(elo.leerElo());
vm.runInContext(script, contexto, { timeout: 30000 });

const fallos = [];
const revisar = (ok, que) => { console.log((ok ? "  ✅ " : "  ❌ ") + que); if (!ok) fallos.push(que); };
const hex = (n) => (typeof n === "number" ? "#" + n.toString(16).padStart(6, "0") : String(n));

["Jinder", "Novato", "Desconocido"].forEach((nombre, i) => {
  const j = { id: i + 1, name: nombre, team: 0, admin: false, conn: "3" + i, auth: "a" + nombre };
  jugadores.set(j.id, j);
  if (room.onPlayerJoin) room.onPlayerJoin(j);
});
correr();

console.log("\n══ Color del nombre en el chat ══");
for (const [id, esperado] of [[1, 0xe74c3c], [2, 0x9b8b7a]]) {
  anuncios.length = 0;
  room.onPlayerChat(jugadores.get(id), "hola a todos");
  const linea = anuncios.find((a) => a.msg.includes("hola a todos"));
  const j = jugadores.get(id);
  console.log(`  ${j.name.padEnd(12)} → ${linea ? `"${linea.msg.trim()}"  color ${hex(linea.color)}` : "(no salió)"}`);
  revisar(Boolean(linea) && linea.color === esperado, `${j.name}: el nombre sale con el color de su división (${hex(esperado)})`);
  revisar(Boolean(linea) && /[🥉🟢🔵🟣🟠🔴🏆]/.test(linea.msg), `${j.name}: lleva el emoji de su división`);
}

console.log("\n══ Sin ELO todavía ══");
anuncios.length = 0;
room.onPlayerChat(jugadores.get(3), "recién llego");
const sinElo = anuncios.find((a) => a.msg.includes("recién llego"));
console.log(`  Desconocido  → ${sinElo ? `"${sinElo.msg.trim()}"` : "(no salió)"}`);
revisar(Boolean(sinElo), "el que no tiene puntaje igual puede chatear");

console.log("\n══ No se rompió lo que ya hacía el script ══");
anuncios.length = 0;
const r = room.onPlayerChat(jugadores.get(1), "!elo");
revisar(r === false && anuncios.some((a) => /pts/.test(a.msg)), "los comandos siguen andando (!elo)");
anuncios.length = 0;
room.onPlayerChat(jugadores.get(1), "hola");
const conPrefijo = anuncios.find((a) => a.msg.includes("hola"));
revisar(Boolean(conPrefijo) && /【|👁|🔴|🔵/.test(conPrefijo.msg), "conserva el prefijo que pone el script");
revisar(anuncios.filter((a) => a.msg.includes("hola")).length === 1, "el mensaje no se manda duplicado");

console.log("");
if (errores.length) console.log("⚠️ errores: " + [...new Set(errores)].join(" | "));
if (fallos.length || errores.length) { try { fs.unlinkSync(ARCHIVO_PRUEBA); } catch {} console.log(`❌ ${fallos.length + errores.length} problema(s)`); process.exit(1); }
fs.unlinkSync(ARCHIVO_PRUEBA);
console.log("✅ El nombre sale con el color de su división\n");
