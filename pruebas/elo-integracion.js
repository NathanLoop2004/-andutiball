// Prueba el circuito completo del ELO: la sala reporta el resultado → Node lo calcula y guarda
// → se lo devuelve a la sala → los comandos !elo y !top lo muestran.
//
//   node pruebas/elo-integracion.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");

const RAIZ = path.join(__dirname, "..");

// Tabla de ELO aparte, para no pisar la de verdad
const ARCHIVO_PRUEBA = path.join(os.tmpdir(), "elo-prueba-" + Date.now() + ".json");
process.env.ELO_FILE = ARCHIVO_PRUEBA;
const elo = require("../lib/elo");

const anuncios = [];
const errores = [];
const jugadores = new Map();
let enJuego = false;
const marcador = { red: 0, blue: 0, time: 180, scoreLimit: 3, timeLimit: 180 };

const room = {
  getPlayerList: () => [...jugadores.values()],
  getPlayer: (id) => jugadores.get(id) || null,
  getScores: () => (enJuego ? marcador : null),
  getBallPosition: () => ({ x: 0, y: 0 }),
  getDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 10, invMass: 1 }),
  getPlayerDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 15, invMass: 1 }),
  getDiscCount: () => 0,
  sendAnnouncement: (msg, id) => anuncios.push({ msg: String(msg), id }),
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

function correrRelojes(topeMs = 3000) {
  for (let v = 0; v < 8; v++) {
    const listos = pendientes.filter((t) => (t.ms || 0) <= topeMs);
    if (!listos.length) return;
    for (const t of listos) pendientes.splice(pendientes.indexOf(t), 1);
    for (const t of listos) { try { t.fn(); } catch (e) { errores.push("timeout: " + e.message); } }
  }
}

const contexto = vm.createContext(ventana);
let script = fs.readFileSync(path.join(RAIZ, "script.js"), "utf8");
const ajustes = JSON.parse(fs.readFileSync(path.join(RAIZ, "hosts/3v3.json"), "utf8"));
for (const [nombre, valor] of Object.entries(ajustes)) {
  const decl = new RegExp(`^([ \\t]*)(var|let|const)\\s+${nombre}\\b[^;\\n]*;?`, "m");
  script = script.replace(decl, (_, s, k) => `${s}${k} ${nombre} = ${JSON.stringify(valor)};`);
}
contexto.__RANGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "roles.json"), "utf8"));
contexto.__ELO = {};          // arrancamos con la tabla vacía, como una sala nueva

vm.runInContext(script, contexto, { timeout: 30000 });

const fallos = [];
// Calcula sobre una copia vacía, sin tocar la tabla de la prueba
const cambios0 = (partido) => elo.aplicarPartido({}, partido);
const revisar = (ok, que) => { console.log((ok ? "  ✅ " : "  ❌ ") + que); if (!ok) fallos.push(que); };

// ── Entran 6 jugadores y se arma 3v3 ──
["Ana", "Beto", "Caro", "Dani", "Eze", "Fer"].forEach((nombre, i) => {
  const j = { id: i + 1, name: nombre, team: i < 3 ? 1 : 2, admin: false, conn: "3" + i, auth: "auth-" + nombre };
  jugadores.set(j.id, j);
  if (room.onPlayerJoin) room.onPlayerJoin(j);
});
correrRelojes();

console.log("\n══ Un partido: gana Red 3-1 ══");
room.startGame();
if (room.onGameStart) room.onGameStart(null);
marcador.red = 3; marcador.blue = 1;
// Como en HaxBall de verdad: primero la victoria (con el marcador) y después se corta el
// partido, así que en onGameStop room.getScores() ya devuelve null.
if (room.onTeamVictory) room.onTeamVictory({ ...marcador });
room.stopGame();
if (room.onGameStop) room.onGameStop(null);

// El bloque deja el resultado en la cola; el launcher la vacía. Acá hacemos lo mismo.
const cola = contexto.window.__panelCola || [];
const evento = cola.find((e) => e.tipo === "elo-partido");
revisar(Boolean(evento), "la sala reporta el resultado del partido");
if (!evento) { console.log("\n❌ Sin evento, no se puede seguir."); process.exit(1); }
revisar(evento.red.length === 3 && evento.blue.length === 3, "reporta los 3 de cada equipo");
revisar(evento.ganador === 1, "reconoce que ganó Red");
revisar(evento.golesRed === 3 && evento.golesBlue === 1, "manda el marcador final");
revisar(cambios0(evento).every((c) => c.equipo && c.resultado !== undefined), "cada cambio sabe su equipo y resultado (para la base)");
revisar(evento.red.every((j) => j.auth), "manda el auth de cada jugador (no solo el nick)");

// ── Node calcula y guarda ──
const tabla = elo.leerElo();
const cambios = elo.aplicarPartido(tabla, evento);
elo.guardarElo(tabla);
console.log("  " + cambios.map((c) => `${c.nombre} ${c.delta >= 0 ? "+" : ""}${c.delta}`).join("  "));
revisar(cambios.length === 6, "calcula el cambio de los 6");
revisar(cambios.filter((c) => c.delta > 0).length === 3, "suben los 3 que ganaron");
revisar(fs.existsSync(ARCHIVO_PRUEBA), "guarda la tabla en disco");

// ── Vuelve a la sala ──
contexto.window.__eloActualizar(elo.paraLaSala(tabla));
anuncios.length = 0;
room.onPlayerChat(jugadores.get(1), "!elo");
const suElo = anuncios.find((a) => /Ana/.test(a.msg));
console.log("  !elo →", suElo ? suElo.msg : "(sin respuesta)");
revisar(Boolean(suElo) && /\d{3,4} pts/.test(suElo.msg), "el comando !elo muestra el puntaje nuevo");

anuncios.length = 0;
room.onPlayerChat(jugadores.get(1), "!top");
const top = anuncios.filter((a) => /pts/.test(a.msg));
console.log("  !top →", top.length, "jugadores listados");
revisar(top.length === 6, "el comando !top lista a los 6");

// ── Un partido cortado con Stop no cuenta ──
console.log("\n══ Partido cortado a mano: no suma ni resta ══");
contexto.window.__panelCola.length = 0;
room.startGame();
if (room.onGameStart) room.onGameStart(null);
room.stopGame();
if (room.onGameStop) room.onGameStop(null);
revisar(!contexto.window.__panelCola.some((e) => e.tipo === "elo-partido"), "un partido cortado con Stop no manda resultado");

// ── Segundo partido: ahora gana Blue ──
console.log("\n══ Segundo partido: gana Blue 2-0 ══");
room.startGame();
if (room.onGameStart) room.onGameStart(null);
marcador.red = 0; marcador.blue = 2;
contexto.window.__panelCola.length = 0;
if (room.onTeamVictory) room.onTeamVictory({ ...marcador });
room.stopGame();
if (room.onGameStop) room.onGameStop(null);
const evento2 = (contexto.window.__panelCola || []).find((e) => e.tipo === "elo-partido");
const tabla2 = elo.leerElo();
const antesAna = tabla2["auth:auth-Ana"].elo;
const cambios2 = elo.aplicarPartido(tabla2, evento2);
elo.guardarElo(tabla2);
console.log("  " + cambios2.map((c) => `${c.nombre} ${c.delta >= 0 ? "+" : ""}${c.delta}`).join("  "));
revisar(tabla2["auth:auth-Ana"].elo < antesAna, "Ana baja al perder el segundo");
revisar(tabla2["auth:auth-Ana"].partidos === 2, "lleva la cuenta de partidos jugados");

// ── Lo que ve el panel ──
console.log("\n══ Lo que muestra el panel ══");
const ranking = elo.ranking(elo.leerElo());
for (const f of ranking) console.log(`  ${f.division.emoji} ${f.nombre.padEnd(6)} ${f.elo} pts · ${f.division.nombre} · ${f.ganados}G ${f.perdidos}P`);
revisar(ranking.length === 6 && ranking[0].elo >= ranking[5].elo, "el ranking del panel sale ordenado");

fs.unlinkSync(ARCHIVO_PRUEBA);
console.log("");
if (errores.length) console.log("⚠️ errores en la sala: " + [...new Set(errores)].join(" | "));
if (fallos.length || errores.length) { console.log(`❌ ${fallos.length + errores.length} problema(s)`); process.exit(1); }
console.log("✅ El circuito completo del ELO funciona\n");
