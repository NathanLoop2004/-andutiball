// Sala de HaxBall falsa con RELOJ VIRTUAL, para probar cosas que dependen del tiempo
// ("a los 5 segundos arranca", "si el capitán no elige en 25 segundos elige el bot").
//
// Falsea Date, setTimeout y setInterval, y dispara onGameTick mientras el partido corre.
// El test decide cuánto tiempo pasa con avanzar(ms).
//
//   const { abrirSala } = require("./sala-falsa");
//   const sala = abrirSala("hosts/3v3.json");
//   sala.entra(1, "Ana"); sala.avanzar(8000); console.log(sala.estado());

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");

function abrirSala(hostConfig, opciones = {}) {
  const errores = [];
  const anuncios = [];
  const webhooks = [];   // lo que el script manda a Discord: { url, cuerpo }
  const camisetas = [];  // cada room.setTeamColors: { equipo, angulo, texto, colores }
  const eventosPanel = [];  // lo que el espía del launcher le manda al panel
  const expulsados = [];    // cada room.kickPlayer: { id, nombre, motivo, ban }
  const avatares = [];      // cada room.setPlayerAvatar: { id, avatar }
  const radios = [];        // cada room.setPlayerDiscProperties con radius: { id, radius }
  const RADIO_NORMAL = 15;  // el que devuelve getPlayerDiscProperties acá

  // ── Reloj virtual ──
  let reloj = 1700000000000;
  let proximoId = 1;
  const relojes = [];
  const programar = (fn, ms, periodo) => {
    const id = proximoId++;
    relojes.push({ id, fn, at: reloj + (ms || 0), periodo: periodo ? Math.max(ms || 1, 1) : null });
    return id;
  };
  const frenar = (id) => {
    const i = relojes.findIndex((t) => t.id === id);
    if (i >= 0) relojes.splice(i, 1);
  };

  // ── Sala ──
  const jugadores = new Map();
  let enJuego = false;
  let pausado = false;
  let arranques = 0;
  let paradas = 0;
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
    // Echar de verdad saca al jugador de la sala y dispara onPlayerLeave, como el host
    kickPlayer: (id, motivo, ban) => {
      const j = jugadores.get(id);
      if (!j) return;
      expulsados.push({ id, nombre: j.name, motivo, ban: Boolean(ban) });
      jugadores.delete(id);
      disparar("onPlayerLeave", j);
    },
    clearBan: () => {}, clearBans: () => {}, setPassword: () => {},
    setRequireRecaptcha: () => {}, setTeamsLock: () => {}, setScoreLimit: () => {}, setTimeLimit: () => {},
    setCustomStadium: () => {}, setDefaultStadium: () => {},
    setPlayerAvatar: (id, avatar) => { avatares.push({ id, avatar: avatar === undefined ? null : avatar }); },
    // Guardamos los cambios de camiseta para poder revisarlos en las pruebas
    setTeamColors: (equipo, angulo, texto, colores) => { camisetas.push({ equipo, angulo, texto, colores }); },
    setDiscProperties: () => {},
    setPlayerDiscProperties: (id, props) => { if (props && typeof props.radius === "number") radios.push({ id, radius: props.radius }); },
    setKickRateLimit: () => {},
    // Mueve a los jugadores dados al final de la lista (así los elige el script en otro orden)
    reorderPlayers: (ids, alPrincipio) => {
      const movidos = ids.map((id) => jugadores.get(id)).filter(Boolean);
      for (const j of movidos) jugadores.delete(j.id);
      const resto = [...jugadores.entries()];
      jugadores.clear();
      if (alPrincipio) for (const j of movidos) jugadores.set(j.id, j);
      for (const [id, j] of resto) jugadores.set(id, j);
      if (!alPrincipio) for (const j of movidos) jugadores.set(j.id, j);
    },
    startRecording: () => {}, stopRecording: () => new Uint8Array(0),
    startGame: () => {
      if (enJuego) return;
      enJuego = true; pausado = false; arranques++;
      disparar("onGameStart", null);
    },
    stopGame: () => {
      if (!enJuego) return;
      enJuego = false; pausado = false; paradas++;
      disparar("onGameStop", null);
    },
    // Igual que el host de verdad: solo avisa cuando el estado cambia
    pauseGame: (estado) => {
      if (!enJuego || pausado === Boolean(estado)) return;
      pausado = Boolean(estado);
      disparar(pausado ? "onGamePause" : "onGameUnpause", null);
    },
  };
  function disparar(evento, arg) {
    if (typeof room[evento] === "function") {
      try { room[evento](arg); } catch (e) { errores.push(evento + ": " + e.message); }
    }
  }

  // ── Entorno del navegador ──
  class FechaFalsa extends Date {
    constructor(...a) { if (a.length) super(...a); else super(reloj); }
    static now() { return reloj; }
  }
  const noop = () => {};
  const elemento = { innerText: "", innerHTML: "", href: "", style: {}, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] };
  // Con { espiar: true } la página recibe la sala envuelta por lib/espia.js, igual que
  // cuando corre de verdad con el launcher
  const salaParaElScript = opciones.espiar
    ? require("../lib/espia").crearSalaEspiada(room, (evento) => eventosPanel.push(evento))
    : room;

  const ventana = {
    HBInit: () => salaParaElScript,
    Date: FechaFalsa,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    XMLHttpRequest: class {
      open(metodo, url) { this.url = url; }
      setRequestHeader() {}
      send(cuerpo) { webhooks.push({ url: this.url, cuerpo: cuerpo }); }
      addEventListener() {}
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    // Guarda lo que se le carga, así las pruebas pueden ver qué texto viaja al webhook
    FormData: class { constructor() { this.datos = {}; } append(k, v) { this.datos[k] = v; } get(k) { return k in this.datos ? this.datos[k] : null; } }, File: class {}, Blob: class {},
    document: { querySelector: () => elemento, querySelectorAll: () => [], createElement: () => elemento, body: elemento },
    console: { log: noop, warn: noop, error: (...a) => errores.push(a.join(" ")) },
    setTimeout: (fn, ms) => programar(fn, ms, false),
    setInterval: (fn, ms) => programar(fn, ms, true),
    clearTimeout: frenar,
    clearInterval: frenar,
  };
  ventana.window = ventana;

  // Mueve el reloj "ms" milisegundos corriendo los timers y los ticks del partido.
  // Los jugadores se mueven en cada tick: si no, el detector de AFK del script los marca a los 15 s.
  function avanzar(ms, paso = 100) {
    const fin = reloj + ms;
    while (reloj < fin) {
      reloj = Math.min(reloj + paso, fin);
      for (let vuelta = 0; vuelta < 50; vuelta++) {
        const listos = relojes.filter((t) => t.at <= reloj).sort((a, b) => a.at - b.at);
        if (!listos.length) break;
        const t = listos[0];
        if (t.periodo) t.at = reloj + t.periodo; else frenar(t.id);
        // Con STACK=1 se ve de dónde salió (sirve para ubicar líneas del script minificado)
        try { t.fn(); } catch (e) { errores.push("timer: " + e.message + (process.env.STACK ? "\n" + e.stack : "")); }
      }
      if (enJuego && !pausado) {
        for (const j of jugadores.values()) if (!j.dormido) j.position = { x: (j.position.x + 7) % 200, y: j.id };
        disparar("onGameTick", null);
      }
    }
  }

  // ── Carga del script, como lo hace el lanzador ──
  const contexto = vm.createContext(ventana);
  let script = fs.readFileSync(path.join(RAIZ, "script.js"), "utf8");
  const ajustes = JSON.parse(fs.readFileSync(path.join(RAIZ, hostConfig), "utf8"));
  for (const [nombre, valor] of Object.entries(ajustes)) {
    const decl = new RegExp(`^([ \\t]*)(var|let|const)\\s+${nombre}\\b[^;\\n]*;?`, "m");
    script = script.replace(decl, (_, s, k) => `${s}${k} ${nombre} = ${JSON.stringify(valor)};`);
  }
  contexto.__RANGOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "roles.json"), "utf8"));
  // El webhook de la sala sale de .env y lo inyecta el lanzador: acá va uno de mentira, porque
  // el arnés atrapa todo lo que se manda (sala.webhooks) y nunca sale a internet.
  contexto.__WEBHOOK_SALA = "https://discord.com/api/webhooks/000000000000000000/de-mentira-para-las-pruebas";
  vm.runInContext(script, contexto, { timeout: 30000 });

  const entra = (id, nombre, opciones) => {
    const j = Object.assign({ id, name: nombre, team: 0, admin: false, conn: "3" + id, auth: "a" + id, position: { x: id, y: 0 } }, opciones || {});
    jugadores.set(id, j);
    disparar("onPlayerJoin", j);
    return j;
  };
  // Varios jugadores, separados en el tiempo: el script echa al 5º que entra dentro de
  // los mismos 2 segundos ("Demasiados ingresos en poco tiempo").
  // Ojo con los nombres: "Jugador1".."Jugador20" están en la ListaDeJogadores de ejemplo
  // del autor y el anti-DU los echa por auth que no coincide.
  const entran = (cantidad, prefijo = "Pibe", desde = 1) => {
    const lista = [];
    for (let i = 0; i < cantidad; i++) {
      lista.push(entra(desde + i, prefijo + (desde + i)));
      avanzar(700);
    }
    return lista;
  };
  const sale = (id) => {
    const j = jugadores.get(id);
    if (!j) return;
    jugadores.delete(id);
    disparar("onPlayerLeave", j);
  };
  const equipos = () => ({
    red: [...jugadores.values()].filter((j) => j.team === 1),
    blue: [...jugadores.values()].filter((j) => j.team === 2),
    espect: [...jugadores.values()].filter((j) => j.team === 0),
  });

  return {
    room, jugadores, contexto, ajustes, errores, anuncios, webhooks, camisetas, eventosPanel, expulsados, avatares, radios, radioNormal: RADIO_NORMAL,
    // Las variables let/const del script no son propiedades del contexto: hay que evaluarlas
    leer: (expresion) => vm.runInContext(expresion, contexto),
    avanzar, entra, entran, sale, equipos, disparar,
    chat: (jugador, texto) => room.onPlayerChat && room.onPlayerChat(jugador, texto),
    // Prende y apaga el AFK como lo hace el comando !afk del script
    afk: (jugador) => { contexto.afkFun(jugador, "!afk"); jugador.dormido = !jugador.dormido; },
    jugando: () => enJuego && !pausado,
    arranques: () => arranques,
    paradas: () => paradas,
    enJuego: () => enJuego,
    pausado: () => pausado,
    estado: () => (!enJuego ? "parado" : pausado ? "en pausa" : "jugando"),
  };
}

module.exports = { abrirSala };
