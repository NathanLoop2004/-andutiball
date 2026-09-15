// Lanzador del host de HaxBall con Puppeteer.
// Abre la página headless, le pasa el token (para saltar el captcha) y ejecuta script.js.
// Además expone una API con el estado de la sala para el panel (ver panel/).
//
// Uso:  pon HAXBALL_TOKEN en .env y corre "npm start" (o pásalo como variable de entorno)
// Token nuevo en https://www.haxball.com/headlesstoken (vence a los pocos minutos).

const fs = require("fs");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer");
const { leerRoles } = require("./lib/roles");
const { ARCHIVO: ARCHIVO_RANGOS, leerRangos, guardarRangos, sinClave } = require("./lib/rangos");

// El token sale de HAXBALL_TOKEN o, si no está, del TOKEN_* que corresponde a esta sala
const salaElegida = (process.env.HOST_CONFIG || "").replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
const tokenDeLaSala = salaElegida ? process.env[`TOKEN_${salaElegida.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] : "";
const token = process.env.HAXBALL_TOKEN || tokenDeLaSala;
if (!token) {
  console.error("❌ Falta el token. Corré 'npm run tokens' o poné HAXBALL_TOKEN en .env");
  console.error("   Se busca HAXBALL_TOKEN y, si no está, TOKEN_3V3 / TOKEN_4V4 / TOKEN_TODOS según HOST_CONFIG.");
  process.exit(1);
}

const PUERTO_API = Number(process.env.API_PORT || 3000);
const MAX_MENSAJES = 500;

const scriptPath = path.join(__dirname, "script.js");
let roomScript = fs.readFileSync(scriptPath, "utf8");

// HOST_CONFIG: JSON con variables de configuración de script.js que se reemplazan en esta sala
// (ej. hosts/3v3.json → { "NombreHost": "...", "MapaPorDefecto": "Futsal x3" })
const hostConfigPath = process.env.HOST_CONFIG;
let hostConfig = {};
if (hostConfigPath) {
  hostConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, hostConfigPath), "utf8"));
  for (const [name, value] of Object.entries(hostConfig)) {
    const declaration = new RegExp(`^([ \\t]*)(var|let|const)\\s+${name}\\b[^;\\n]*;?`, "m");
    if (!declaration.test(roomScript)) {
      console.warn(`⚠️ ${hostConfigPath}: la variable "${name}" no existe en script.js, se ignora`);
      continue;
    }
    roomScript = roomScript.replace(declaration, (_, indent, keyword) => `${indent}${keyword} ${name} = ${JSON.stringify(value)};`);
  }
  console.log(`⚙️ Configuración aplicada: ${hostConfigPath} (${Object.keys(hostConfig).join(", ")})`);
}

// Verifica la sintaxis antes de abrir el navegador
try {
  new Function(roomScript);
} catch (error) {
  console.error("❌ script.js tiene un error de sintaxis:", error.message);
  process.exit(1);
}

// ── Estado que consume el panel ─────────────────────────────────────────────
const estado = {
  sala: process.env.ROOM_NAME || hostConfig.NombreHost || "Sala",
  config: hostConfig,
  roles: leerRoles(roomScript),
  rangos: sinClave(leerRangos()),
  encendida: false,
  problema: null,
  link: null,
  desde: null,
  jugadores: [],
  mensajes: [],
  bans: [],
  partido: { enJuego: false, red: 0, blue: 0 },
};

const agregarMensaje = (tipo, texto, datos = {}) => {
  estado.mensajes.push({ hora: new Date().toISOString(), tipo, texto, ...datos });
  if (estado.mensajes.length > MAX_MENSAJES) estado.mensajes.shift();
};

// El mismo servidor sirve la API y el panel, así "npm start" no necesita otra terminal.
const paginaPanel = path.join(__dirname, "panel", "index.html");

const api = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.url.startsWith("/api/estado")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(estado));
    return;
  }

  // Rangos: el panel los lee y los guarda acá
  if (req.url.startsWith("/api/rangos")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "GET") {
      res.end(JSON.stringify(sinClave(leerRangos())));
      return;
    }
    if (req.method === "POST") {
      let cuerpo = "";
      req.on("data", (c) => (cuerpo += c));
      req.on("end", () => {
        try {
          const enviado = JSON.parse(cuerpo);
          const actual = leerRangos();
          // Si no mandan clave nueva, se conserva la que ya estaba
          const guardado = guardarRangos({ ...enviado, clave: enviado.clave ? enviado.clave : actual.clave });
          res.end(JSON.stringify(sinClave(guardado)));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  // El panel pide /api/salas; con una sola sala, devolvemos solo esta
  if (req.url.startsWith("/api/salas")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ salas: [{ clave: "sala", nombre: estado.sala, ok: true, estado }] }));
    return;
  }

  const pagina = req.url.startsWith("/rangos") ? path.join(__dirname, "panel", "rangos.html") : paginaPanel;
  if (fs.existsSync(pagina)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(fs.readFileSync(pagina));
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});
api.listen(PUERTO_API, () => console.log(`🖥️  Panel de esta sala en http://localhost:${PUERTO_API}`));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Sin esto WebRTC oculta la IP real y los jugadores no pueden conectarse
      "--disable-features=WebRtcHideLocalIpsWithMdns",
    ],
  });

  const page = await browser.newPage();

  page.on("console", (msg) => console.log(`[sala] ${msg.text()}`));
  page.on("pageerror", (error) => console.error(`[sala][error] ${error.message}`));

  await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });

  // El HBInit real vive dentro del iframe de la página headless
  const frame = page.frames().find((f) => f.url().includes("html5.haxball.com")) || page.mainFrame();
  await frame.waitForFunction("typeof HBInit === 'function'", { timeout: 30000 });

  // Puente: la página deja los eventos en una cola y Node la vacía cada segundo.
  // (No usamos page.exposeFunction porque no alcanza al iframe donde corre la sala.)
  const procesarEvento = (evento) => {
    switch (evento.tipo) {
      case "link":
        estado.link = evento.link;
        estado.encendida = true;
        estado.problema = null;
        estado.desde = new Date().toISOString();
        console.log(`🔗 Sala abierta: ${evento.link}`);
        break;
      case "chat":
        agregarMensaje("chat", evento.texto, { jugador: evento.jugador });
        break;
      case "entra":
        agregarMensaje("entra", `${evento.jugador} entró a la sala`, { jugador: evento.jugador });
        break;
      case "sale":
        agregarMensaje("sale", `${evento.jugador} salió de la sala`, { jugador: evento.jugador });
        break;
      case "expulsion": {
        const accion = evento.ban ? "baneó" : "expulsó";
        const quien = evento.porJugador || "El bot";
        agregarMensaje(evento.ban ? "ban" : "kick", `${quien} ${accion} a ${evento.jugador}${evento.motivo ? ` (${evento.motivo})` : ""}`);
        if (evento.ban) {
          estado.bans.push({ hora: new Date().toISOString(), jugador: evento.jugador, motivo: evento.motivo || "", por: quien });
        }
        break;
      }
      case "bans-limpios":
        estado.bans = [];
        agregarMensaje("ban", "Se limpió la lista de baneados");
        break;
      case "gol":
        agregarMensaje("gol", `Gol de ${evento.equipo === 1 ? "🔴 Red" : "🔵 Blue"}`);
        break;
      case "partido":
        estado.partido.enJuego = evento.enJuego;
        agregarMensaje("partido", evento.enJuego ? "Arrancó el partido" : "Terminó el partido");
        break;
      case "jugadores":
        estado.jugadores = evento.jugadores;
        estado.partido.red = evento.red;
        estado.partido.blue = evento.blue;
        break;
    }
  };

  // Los rangos y su clave viajan a la página antes de correr el script
  await frame.evaluate((rangos) => {
    window.__RANGOS = rangos;
  }, leerRangos());

  // Envuelve HBInit: agrega el token y engancha el puente del panel sin tocar el script
  await frame.evaluate((token) => {
    window.__panelCola = [];
    const avisar = (evento) => {
      window.__panelCola.push(evento);
      if (window.__panelCola.length > 300) window.__panelCola.shift();
    };
    const nombre = (jugador) => (jugador && jugador.name) || "—";

    const originalHBInit = window.HBInit;
    window.HBInit = (config) => {
      const sala = originalHBInit({ ...config, token });

      // Estado de jugadores y marcador, una vez por segundo
      setInterval(() => {
        try {
          const lista = sala.getPlayerList().map((j) => ({ id: j.id, nombre: j.name, equipo: j.team, admin: j.admin }));
          const marcador = sala.getScores();
          avisar({
            tipo: "jugadores",
            jugadores: lista,
            red: marcador ? marcador.red : 0,
            blue: marcador ? marcador.blue : 0,
          });
        } catch {
          // La sala todavía no está lista
        }
      }, 1000);

      // Espía los eventos sin reemplazar los del script: encadena el handler original
      const espiados = {
        // Así entrega HaxBall el link de la sala; leerlo del HTML no es confiable
        onRoomLink: (url) => avisar({ tipo: "link", link: url }),
        onPlayerChat: (j, m) => avisar({ tipo: "chat", jugador: nombre(j), texto: m }),
        onPlayerJoin: (j) => avisar({ tipo: "entra", jugador: nombre(j) }),
        onPlayerLeave: (j) => avisar({ tipo: "sale", jugador: nombre(j) }),
        onPlayerKicked: (j, motivo, ban, por) => avisar({ tipo: "expulsion", jugador: nombre(j), motivo, ban, porJugador: por ? nombre(por) : null }),
        onTeamGoal: (equipo) => avisar({ tipo: "gol", equipo }),
        onGameStart: () => avisar({ tipo: "partido", enJuego: true }),
        onGameStop: () => avisar({ tipo: "partido", enJuego: false }),
      };

      return new Proxy(sala, {
        set(destino, prop, valor) {
          const espia = espiados[prop];
          destino[prop] = espia
            ? (...args) => {
                try {
                  espia(...args);
                } catch {
                  // Un fallo del panel nunca debe romper la sala
                }
                return typeof valor === "function" ? valor(...args) : undefined;
              }
            : valor;
          return true;
        },
        get(destino, prop) {
          const valor = destino[prop];
          if (prop === "clearBans" && typeof valor === "function") {
            return (...args) => {
              avisar({ tipo: "bans-limpios" });
              return valor.apply(destino, args);
            };
          }
          return typeof valor === "function" ? valor.bind(destino) : valor;
        },
      });
    };
  }, token);

  // Si el script nunca asigna un handler espiado, igual lo enganchamos al arrancar
  await frame.evaluate(roomScript);
  console.log("✅ script.js cargado. Esperando el link de la sala...");

  // Vaciamos la cola de eventos y leemos el link directo de la página
  setInterval(async () => {
    try {
      const lote = await frame.evaluate(() => {
        const cola = window.__panelCola || [];
        window.__panelCola = [];
        const enlace = document.querySelector("#roomlink a");
        return { eventos: cola, link: enlace ? enlace.href : null };
      });
      lote.eventos.forEach(procesarEvento);
      if (lote.link && lote.link !== estado.link) procesarEvento({ tipo: "link", link: lote.link });
    } catch {
      // La página se está recargando o ya se cerró
    }
  }, 1000);

  // Si el token venció o no sirve, HaxBall pide el captcha y el link nunca aparece.
  // En vez de quedarnos callados, lo avisamos claro.
  const ESPERA_LINK_MS = Number(process.env.ESPERA_LINK_MS || 40000);
  setTimeout(async () => {
    if (estado.link) return;

    // Con el token vencido, HaxBall carga el captcha en un iframe de Google
    const pideCaptcha = page.frames().some((f) => /recaptcha|turnstile/i.test(f.url()));

    estado.encendida = false;
    estado.problema = pideCaptcha
      ? "El token venció o no sirve: HaxBall está pidiendo el captcha"
      : "La sala no dio su link a tiempo";

    console.error("");
    console.error("❌ " + estado.problema.toUpperCase());
    if (pideCaptcha) {
      console.error("   Los tokens duran pocos minutos y se usan una sola vez.");
      console.error("   👉 Sacá uno nuevo con 'npm run tokens' y volvé a arrancar enseguida.");
    } else {
      console.error("   Puede ser la conexión a internet o que HaxBall esté caído.");
      console.error("   👉 Probá de nuevo; si sigue, revisá https://www.haxball.com");
    }
    console.error("   La sala sigue abierta por las dudas: cortá con Ctrl+C si querés reintentar.");
    console.error("");
  }, ESPERA_LINK_MS);

  // Si se editan los rangos desde el panel, se aplican en caliente (sin reiniciar la sala)
  let recargando = null;
  fs.watch(path.dirname(ARCHIVO_RANGOS), (_, archivo) => {
    if (archivo !== path.basename(ARCHIVO_RANGOS)) return;
    clearTimeout(recargando);
    recargando = setTimeout(async () => {
      const rangos = leerRangos();
      estado.rangos = sinClave(rangos);
      try {
        await frame.evaluate((datos) => window.__rangosActualizar && window.__rangosActualizar(datos), rangos);
        console.log(`🎖️ Rangos recargados (${rangos.roles.length} roles)`);
      } catch (error) {
        console.error("⚠️ No se pudieron recargar los rangos:", error.message);
      }
    }, 300);
  });

  const shutdown = async () => {
    console.log("👋 Cerrando sala...");
    estado.encendida = false;
    api.close();
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((error) => {
  console.error("❌ No se pudo iniciar la sala:", error);
  estado.encendida = false;
  process.exit(1);
});
