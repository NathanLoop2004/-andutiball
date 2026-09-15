// Simula una sala de HaxBall para probar script.js sin gastar un token.
// Imita la API de la Headless Host y dispara los eventos: entrar, chatear, gol, salir.
// Uso:  npm run prueba
//
// No reemplaza probar en una sala real, pero atrapa errores como "X is not defined".

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const errores = [];
const anuncios = [];

function stubRoom() {
  const jugadores = new Map();
  const marcador = { red: 0, blue: 0, time: 30, scoreLimit: 3, timeLimit: 300 };
  let enJuego = false;
  const room = {
    // Lectura
    getPlayerList: () => [...jugadores.values()],
    getPlayer: (id) => jugadores.get(id) || null,
    // Sin partido en curso, HaxBall devuelve null (el script lo usa como guarda)
    getScores: () => (enJuego ? marcador : null),
    getBallPosition: () => ({ x: 0, y: 0 }),
    getDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 10, invMass: 1 }),
    getPlayerDiscProperties: () => ({ x: 0, y: 0, xspeed: 0, yspeed: 0, radius: 15, invMass: 1 }),
    getDiscCount: () => 0,
    // Escritura
    sendAnnouncement: (msg, id, color, style, sound) => anuncios.push({ msg: String(msg), id }),
    setPlayerAdmin: (id, v) => jugadores.has(id) && (jugadores.get(id).admin = v),
    setPlayerTeam: (id, t) => jugadores.has(id) && (jugadores.get(id).team = t),
    kickPlayer: () => {},
    clearBan: () => {},
    clearBans: () => {},
    setPassword: () => {},
    setRequireRecaptcha: () => {},
    setTeamsLock: () => {},
    setScoreLimit: () => {},
    setTimeLimit: () => {},
    setCustomStadium: () => {},
    setDefaultStadium: () => {},
    setTeamColors: () => {},
    setPlayerAvatar: () => {},
    setDiscProperties: () => {},
    setPlayerDiscProperties: () => {},
    setKickRateLimit: () => {},
    reorderPlayers: () => {},
    startGame: () => { enJuego = true; },
    stopGame: () => { enJuego = false; },
    pauseGame: () => {},
    startRecording: () => {},
    stopRecording: () => new Uint8Array(0),
    _jugadores: jugadores,
  };
  return room;
}

function entorno(room) {
  const almacen = {};
  const noop = () => {};
  const elemento = { innerText: "", innerHTML: "", href: "", style: {}, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] };
  const ventana = {
    HBInit: (config) => {
      ventana.__config = config;
      return room;
    },
    localStorage: {
      getItem: (k) => (k in almacen ? almacen[k] : null),
      setItem: (k, v) => (almacen[k] = String(v)),
      removeItem: (k) => delete almacen[k],
    },
    XMLHttpRequest: class {
      open() {} setRequestHeader() {} send() {} addEventListener() {}
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    FormData: class { append() {} },
    File: class {},
    Blob: class {},
    document: { querySelector: () => elemento, querySelectorAll: () => [], createElement: () => elemento, body: elemento },
    console: { log: noop, warn: noop, error: (...a) => errores.push("console.error: " + a.join(" ")) },
    setTimeout: (fn, ms) => setTimeout(() => { try { fn(); } catch (e) { errores.push("setTimeout: " + e.message); } }, Math.min(ms || 0, 50)),
    setInterval: () => 0,
    clearInterval: noop,
    clearTimeout: noop,
  };
  ventana.window = ventana;
  return ventana;
}

function correr(nombre, fn) {
  try {
    fn();
  } catch (error) {
    errores.push(`${nombre}: ${error.message}`);
  }
}

(function main() {
  const room = stubRoom();
  const contexto = vm.createContext(entorno(room));
  let script = fs.readFileSync(path.join(RAIZ, "script.js"), "utf8");

  // Aplicamos la configuración de la sala igual que el lanzador
  const hostConfig = process.env.HOST_CONFIG || "hosts/todos.json";
  const ajustes = JSON.parse(fs.readFileSync(path.join(RAIZ, hostConfig), "utf8"));
  for (const [nombre, valor] of Object.entries(ajustes)) {
    const declaracion = new RegExp(`^([ \\t]*)(var|let|const)\\s+${nombre}\\b[^;\\n]*;?`, "m");
    script = script.replace(declaracion, (_, sangria, palabra) => `${sangria}${palabra} ${nombre} = ${JSON.stringify(valor)};`);
  }
  console.log(`⚙️ Config: ${hostConfig}`);

  // Los rangos, como los inyecta el lanzador
  contexto.__RANGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "roles.json"), "utf8"));

  try {
    vm.runInContext(script, contexto, { timeout: 30000 });
  } catch (error) {
    console.error("❌ El script no llegó a cargar:", error.message);
    process.exit(1);
  }
  console.log("✅ script.js cargó entero");

  const jinder = { id: 1, name: "Jinder", team: 0, admin: false, conn: "3132372e302e302e31", auth: "auth-jinder" };
  const visita = { id: 2, name: "Visitante", team: 0, admin: false, conn: "3139322e3136382e312e32", auth: "auth-visita" };
  room._jugadores.set(1, jinder);
  room._jugadores.set(2, visita);

  correr("onPlayerJoin (con rango)", () => room.onPlayerJoin && room.onPlayerJoin(jinder));
  correr("onPlayerJoin (sin rango)", () => room.onPlayerJoin && room.onPlayerJoin(visita));
  correr("onPlayerChat (clave del rango)", () => room.onPlayerChat && room.onPlayerChat(jinder, "Borjaelias2004"));
  correr("onPlayerChat (mensaje normal)", () => room.onPlayerChat && room.onPlayerChat(visita, "hola a todos"));
  correr("onPlayerChat (!help)", () => room.onPlayerChat && room.onPlayerChat(visita, "!help"));
  correr("onPlayerChat (!camisetas)", () => room.onPlayerChat && room.onPlayerChat(visita, "!camisetas"));
  correr("onPlayerChat (!mapas)", () => room.onPlayerChat && room.onPlayerChat(visita, "!mapas"));
  correr("onPlayerChat (!rs de admin)", () => { jinder.admin = true; room.onPlayerChat && room.onPlayerChat(jinder, "!rs"); });
  correr("onPlayerChat (comando inexistente)", () => room.onPlayerChat && room.onPlayerChat(visita, "!noexiste"));
  correr("onPlayerChat (comando perdido)", () => room.onPlayerChat && room.onPlayerChat(visita, "!me"));
  correr("onPlayerTeamChange", () => { visita.team = 1; room.onPlayerTeamChange && room.onPlayerTeamChange(visita, jinder); });
  correr("onGameStart", () => { room.startGame(); room.onGameStart && room.onGameStart(jinder); });

  // Gol con autor y asistencia: primero simulamos los toques a la pelota
  correr("onTeamGoal (con goleador)", () => {
    room._jugadores.set(3, { id: 3, name: "Chelato", team: 1, admin: false, conn: "31", auth: "a3" });
    const chelato = room.getPlayer(3);
    if (room.onPlayerBallKick) {
      room.onPlayerBallKick(jinder);   // asistencia
      room.onPlayerBallKick(chelato);  // gol
    }
    room.onTeamGoal && room.onTeamGoal(1);
  });
  correr("onPositionsReset", () => room.onPositionsReset && room.onPositionsReset());
  correr("onGameStop", () => room.onGameStop && room.onGameStop(jinder));
  correr("onPlayerKicked", () => room.onPlayerKicked && room.onPlayerKicked(visita, "prueba", true, jinder));
  correr("onPlayerLeave", () => room.onPlayerLeave && (room._jugadores.delete(2), room.onPlayerLeave(visita)));
  correr("onRoomLink", () => room.onRoomLink && room.onRoomLink("https://www.haxball.com/play?c=PRUEBA"));

  // Entran 5 espectadores: el árbitro debería repartirlos en los equipos
  correr("acomodar equipos", () => {
    for (let i = 10; i < 15; i++) {
      const j = { id: i, name: "Jugador" + i, team: 0, admin: false, conn: "3" + i, auth: "a" + i };
      room._jugadores.set(i, j);
      room.onPlayerJoin && room.onPlayerJoin(j);
    }
    if (typeof contexto.revisarSala === "function") contexto.revisarSala();
  });

  setTimeout(() => {
    console.log(`📣 anuncios enviados: ${anuncios.length}`);
    const gol = anuncios.find((a) => /GOL/.test(a.msg));
    console.log("⚽ anuncio de gol:", gol ? gol.msg : "❌ NO SE ANUNCIÓ NINGÚN GOL");
    const equipos = [...room._jugadores.values()].map((j) => `${j.name}=${j.team}`).join(" ");
    console.log("👥 equipos tras acomodar:", equipos);
    const muestra = anuncios.slice(0, 6).map((a) => "   · " + a.msg.split("\n")[0].slice(0, 70));
    if (muestra.length) console.log(muestra.join("\n"));

    if (errores.length) {
      console.log(`\n❌ ${errores.length} errores:`);
      for (const e of [...new Set(errores)]) console.log("   " + e);
      process.exit(1);
    }
    console.log("\n✅ Ningún error en los eventos probados");
  }, 400);
})();
