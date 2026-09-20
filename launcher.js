// Lanzador del host de HaxBall con Puppeteer.
// Abre la página headless, le pasa el token (para saltar el captcha) y ejecuta script.js.
// Además expone una API con el estado de la sala para el panel (ver panel/).
//
// Uso:  pon HAXBALL_TOKEN en .env y corre "npm start" (o pásalo como variable de entorno)
// Token nuevo en https://www.haxball.com/headlesstoken (vence a los pocos minutos).

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { crearApp } = require("./app");
const { crearSalaEspiada } = require("./lib/espia");
const EstadoModel = require("./models/EstadoModel");
const UsuarioModel = require("./models/UsuarioModel");
const RangoModel = require("./models/RangoModel");
const PartidoModel = require("./models/PartidoModel");
const ConfigModel = require("./models/ConfigModel");
const EloSalasModel = require("./models/EloSalasModel");
const MonedasModel = require("./models/MonedasModel");
const EquiposModel = require("./models/EquiposModel");
const TiendaModel = require("./models/TiendaModel");
const RachasModel = require("./models/RachasModel");
const Parametros = require("./lib/parametros");
const WebhookWeb = require("./services/WebhookWeb");
const { leerRoles } = require("./lib/roles");
const { ARCHIVO: ARCHIVO_RANGOS, leerRangos, guardarRangos, sinClave } = require("./lib/rangos");
const { leerElo, guardarElo, aplicarPartido, ranking, paraLaSala, ambitoValido, DIVISIONES } = require("./lib/elo");

// Qué sala levantar: "npm start 3v3" pesa más que el HOST_CONFIG del .env.
// Sin argumento, usa el .env; si tampoco está, la sala de futsal automático.
{
  const pedida = (process.argv[2] || "").trim().toLowerCase();
  if (pedida) {
    // "todas" es el comando de las 4 salas, no una sala: avisamos en vez de abrir una sola
    if (["todas", "todo", "all", "4", "cuatro"].includes(pedida)) {
      console.error(`\n❌ "${pedida}" no es una sala.`);
      console.error("   👉 Para levantar las 4 juntas:  npm run todas");
      console.error("   👉 Para una sola:               npm start 3v3 | 4v4 | todos | realsoccer\n");
      process.exit(1);
    }
    const archivo = path.join(__dirname, "hosts", `${pedida}.json`);
    if (!fs.existsSync(archivo)) {
      const disponibles = fs.readdirSync(path.join(__dirname, "hosts")).filter((a) => a.endsWith(".json")).map((a) => a.replace(/\.json$/, ""));
      console.error(`\n❌ No existe la sala "${pedida}".`);
      console.error(`   Salas disponibles: ${disponibles.join(" · ")}`);
      console.error("   👉 Para levantar las 4 juntas:  npm run todas\n");
      process.exit(1);
    }
    process.env.HOST_CONFIG = `hosts/${pedida}.json`;
  }
}

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

// El ELO de esta sala va en datos/elo-<sala>.json (además del general, datos/elo.json)
const ambitoSala = salaElegida && ambitoValido(salaElegida) ? salaElegida : null;
// Lo que recibe la página: el ELO de la sala (color, !elo, !top) y el general (!elo general)
const eloParaLaPagina = () => ({
  sala: ambitoSala ? paraLaSala(leerElo(ambitoSala)) : paraLaSala(leerElo()),
  general: paraLaSala(leerElo()),
});

// Verifica la sintaxis antes de abrir el navegador
try {
  new Function(roomScript);
} catch (error) {
  console.error("❌ script.js tiene un error de sintaxis:", error.message);
  process.exit(1);
}

// ── Estado que consume el panel ─────────────────────────────────────────────
// La forma la define EstadoModel; acá solo se la va completando con lo que se ve
// en la sala (el puente con Puppeteer está más abajo).
const estado = EstadoModel.crear({
  sala: process.env.ROOM_NAME || hostConfig.NombreHost || "Sala",
  config: hostConfig,
  roles: leerRoles(roomScript),
  rangos: sinClave(leerRangos()),
  elo: ranking(leerElo(ambitoSala), 50),
  divisiones: DIVISIONES,
});

const agregarMensaje = (tipo, texto, datos = {}) => EstadoModel.agregarMensaje(estado, tipo, texto, datos);

// El mismo servidor sirve la API y el panel, así "npm start" no necesita otra terminal.
// Las rutas están en routes/, la lógica en controllers/ y models/, y las pantallas
// en views/ — todo se arma en app.js. Acá solo se inyecta ESTA sala.
let framePagina = null;   // asignado cuando la sala está lista, lo usa /api/kick y /api/ban

const app = crearApp({
  sala: {
    estado: () => estado,
    // El kick lo hace la página: window.__sala es la sala de HaxBall
    expulsar: async (id, motivo, banear) => {
      if (!framePagina) throw new Error("La sala todavía no está lista");
      await framePagina.evaluate((idJugador, razonTexto, esBan) => {
        if (window.__sala && typeof window.__sala.kickPlayer === "function") {
          window.__sala.kickPlayer(idJugador, razonTexto, esBan);
        }
      }, id, motivo, banear);
    },
  },
});

const api = app.listen(PUERTO_API, () => console.log(`🖥️  Panel de esta sala en http://localhost:${PUERTO_API}`));
api.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n❌ El puerto ${PUERTO_API} ya está ocupado: seguramente tenés otra sala abierta.`);
    console.error(`   👉 Levantá esta en otro puerto:  $env:API_PORT=3001; npm start ${salaElegida || ""}`.trimEnd());
    console.error("   👉 O levantá las 4 juntas:        npm run todas\n");
  } else {
    console.error("❌ No se pudo abrir el panel:", error.message);
  }
  process.exit(1);
});

(async () => {
  // PROXY opcional: si esta sala tiene PROXY_<CLAVE> en .env, Chrome sale por ese proxy.
  // Sin PROXY, sale por la IP local. Sirve para no chocar con el límite de HaxBall.
  const claveProxy = salaElegida ? `PROXY_${salaElegida.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : "";
  const urlProxyRaw = (process.env.HAXBALL_PROXY || (claveProxy ? process.env[claveProxy] : "") || "").trim();

  let proxyParaChrome = "";
  let credencialesProxy = null;
  if (urlProxyRaw) {
    const m = urlProxyRaw.match(/^(https?|socks5?):\/\/(?:([^:@]+):([^@]+)@)?([^\s]+)$/i);
    if (!m) {
      console.error(`❌ ${claveProxy || "HAXBALL_PROXY"} inválido. Formato esperado: http://usuario:clave@ip:puerto`);
      process.exit(1);
    }
    proxyParaChrome = `${m[1]}://${m[4]}`;
    if (m[2] && m[3]) credencialesProxy = { username: m[2], password: m[3] };
  }

  const argsChrome = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ];
  if (proxyParaChrome) {
    argsChrome.push(`--proxy-server=${proxyParaChrome}`);
    console.log(`🌐 Esta sala sale por proxy: ${proxyParaChrome}${credencialesProxy ? " (con usuario)" : ""}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: argsChrome,
  });

  const page = await browser.newPage();

  if (credencialesProxy) await page.authenticate(credencialesProxy);

  // Filtramos ruido: los webhooks del autor original (Discord ajenos) devuelven 404 constantes.
  const ruido = [
    /Failed to load resource.*status of 404/i,
    /MONITOR: Boletero/i,
  ];
  page.on("console", (msg) => {
    const texto = msg.text();
    if (ruido.some((r) => r.test(texto))) return;
    console.log(`[sala] ${texto}`);
  });
  page.on("pageerror", (error) => console.error(`[sala][error] ${error.message}`));

  await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });

  // El HBInit real vive dentro del iframe de la página headless
  const frame = page.frames().find((f) => f.url().includes("html5.haxball.com")) || page.mainFrame();
  framePagina = frame;   // habilita /api/kick y /api/ban desde el panel
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
      case "config":
        agregarMensaje("config", `⚙️ Aplicado desde la web: ${evento.texto}`);
        console.log(`⚙️ Aplicado desde la web: ${evento.texto}`);
        break;
      // Un admin lo cambió con un comando adentro de la sala (!powershot, !ganasigue…): a la base,
      // así la web muestra lo que pasa de verdad.
      // Alguien se puso una camiseta con !camiseta en la sala
      case "camiseta":
        TiendaModel.elegir(evento.nick, evento.clave)
          .then(() => refrescarCamisetas())
          .catch((error) => console.warn(`⚠️ No se pudo guardar la camiseta de ${evento.nick}: ${String(error.message).split("\n")[0]}`));
        break;
      case "config-sala":
        if (salaElegida) {
          ConfigModel.guardar(salaElegida, evento.nombre, evento.valor, "la sala")
            .then(() => {
              const texto = `⚙️ Cambiado en la sala y guardado en la web: ${evento.nombre} = ${JSON.stringify(evento.valor)}`;
              agregarMensaje("config", texto);
              console.log(texto);
            })
            .catch((error) => console.warn(`⚠️ No se pudo guardar ${evento.nombre} en la base: ${String(error.message).split("\n")[0]}`));
        }
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
      case "jugadores": {
        // Le pegamos a cada jugador su puntaje y división, para que el panel
        // pueda pintar el nombre con el color que le corresponde
        const tablaElo = paraLaSala(leerElo(ambitoSala));
        estado.jugadores = evento.jugadores.map((j) => {
          const ficha = tablaElo[String(j.nombre).toLowerCase()];
          return ficha ? { ...j, elo: ficha.elo, division: ficha.division, emoji: ficha.emoji, color: ficha.color } : j;
        });
        estado.partido.red = evento.red;
        estado.partido.blue = evento.blue;
        break;
      }
      case "usuario":
        atenderUsuario(evento);
        break;
      case "elo-partido":
        procesarPartidoElo(evento);
        break;
    }
  };

  // Claves de los usuarios: el script pregunta y nosotros le contestamos.
  // Si la base está apagada NO se traba la sala: se contesta "sin-base" y a jugar.
  const atenderUsuario = async (evento) => {
    const contestar = (respuesta) => {
      frame
        .evaluate((r) => { if (window.__usuarioRespuesta) window.__usuarioRespuesta(r); }, { id: evento.id, accion: evento.accion, ...respuesta })
        .catch(() => {});
    };

    try {
      if (evento.accion === "verificar") {
        const { ok, motivo } = await UsuarioModel.verificar({ nick: evento.nick, clave: evento.clave, auth: evento.auth });
        agregarMensaje("usuario", ok ? `${evento.nick} puso bien su clave` : `${evento.nick} erró la clave`, { jugador: evento.nick });
        return contestar({ ok, motivo });
      }

      // Desde la sala NO se crean cuentas ni se cambian claves: eso es solo en la web.
      // Aunque alguien empuje un pedido "registrar" o "cambiar", acá no se toca la base.
      return contestar({ ok: false, motivo: "Las cuentas se crean y se cambian solo en la página de ÑandutíHax" });
    } catch (error) {
      const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
      if (sinBase) console.warn("⚠️ La base no responde: la sala sigue andando, sin pedir claves");
      return contestar({ ok: false, motivo: sinBase ? "sin-base" : error.message });
    }
  };

  // Los rangos, desde la tabla `rangos`. Se mandan cada pocos segundos y la sala vuelve a
  // aplicarlos: si alguien se mete javascript y se pone admin, en la próxima pasada se le cae.
  // Si la base está apagada, paraLaSala() devuelve lo de roles.json (el espejo).
  let avisamosRangosCaidos = false;
  const refrescarRangos = async () => {
    try {
      const { rangos, desde } = await RangoModel.paraLaSala();
      if (!rangos.length) return;
      await frame.evaluate((lista) => {
        window.__RANGOS_TABLA = lista;
        if (window.__rangosDeLaBase) window.__rangosDeLaBase(lista);
      }, rangos);
      if (avisamosRangosCaidos) {
        avisamosRangosCaidos = false;
        console.log(`🎖️ Rangos otra vez desde ${desde}`);
      }
    } catch (error) {
      if (!avisamosRangosCaidos) {
        avisamosRangosCaidos = true;
        console.warn("⚠️ No se pudieron leer los rangos: " + error.message.split("\n")[0]);
      }
    }
  };

  // El link público de la web (el del túnel de Cloudflare). tunel.js lo deja escrito en
  // datos/tunel.json y cada sala lo lee: es lo que se le muestra al que todavía no tiene
  // cuenta, porque las cuentas se crean en la web y no desde el chat.
  let ultimoLinkWeb = null;
  const refrescarLinkWeb = async () => {
    try {
      const { url, estado } = WebhookWeb.leerGuardado();
      const link = estado === "arriba" && url ? url : null;
      if (link === ultimoLinkWeb) return;
      ultimoLinkWeb = link;
      await frame.evaluate((direccion) => { window.__WEB_URL = direccion; }, link);
      if (link) console.log(`🌐 La sala ya sabe dónde se registra la gente: ${link}`);
    } catch (error) {
      // sin túnel abierto, el bloque manda al Discord
    }
  };

  // La lista de nombres registrados: es lo que mira el script para saber a quién pedirle clave
  const refrescarUsuarios = async () => {
    try {
      const nicks = await UsuarioModel.nicksRegistrados();
      // Los baneados desde la pantalla de usuarios (OWNER): la sala los echa al entrar
      const baneados = await UsuarioModel.baneados().catch(() => []);
      await frame.evaluate((lista, bans) => {
        window.__USUARIOS = lista;
        window.__BANEADOS = bans;
        if (window.__usuariosActualizar) window.__usuariosActualizar(lista);
        if (window.__baneadosActualizar) window.__baneadosActualizar(bans);
      }, nicks, baneados);
      return nicks.length;
    } catch (error) {
      // Sin base no se le pide clave a nadie
      await frame.evaluate(() => { window.__USUARIOS = []; }).catch(() => {});
      return null;
    }
  };

  // Rachas: cuántas viene ganando seguidas cada uno. Se avisa en la sala cuando llega a 3, 5, 10…
  const anotarRachas = async (evento) => {
    try {
      const permitidos = await EloSalasModel.conCuenta(evento);
      const tieneCuenta = (j) => j.verificado === true && permitidos.has(String(j.nombre || "").trim().toLowerCase());
      const equipo = (lado) => (evento[lado] || []).filter(tieneCuenta).map((j) => j.nombre);
      if (!evento.ganador) return;   // en un empate no hay racha que sumar, pero sí se corta
      const ganadores = equipo(evento.ganador === 1 ? "red" : "blue");
      const perdedores = equipo(evento.ganador === 1 ? "blue" : "red");
      const novedades = await RachasModel.anotarPartido({ ganadores, perdedores });

      const lineas = [];
      for (const n of novedades) {
        if (n.record && n.actual >= 3) lineas.push(`🔥 ${n.nick} hizo su mejor racha: ${n.actual} seguidas`);
        else if (n.premio) lineas.push(`🔥 ${n.nick} lleva ${n.actual} ganadas seguidas`);
        else if (n.cortada) lineas.push(`💔 Se le cortó la racha a ${n.nick} (venía de ${n.cortada})`);
      }
      if (!lineas.length) return;
      agregarMensaje("racha", lineas.join(" · "));
      await frame.evaluate((textos) => {
        if (!window.__sala) return;
        for (const t of textos) window.__sala.sendAnnouncement(t, null, 0xFF8C00, "bold", 2);
      }, lineas).catch(() => {});
    } catch (error) {
      console.warn(`⚠️ Las rachas no se anotaron: ${String(error.message).split("\n")[0]}`);
    }
  };

  // Monedas: solo cobra el equipo que GANA, y solo el que tiene cuenta con su clave puesta.
  // Lo que ganó cada uno se le avisa EN PRIVADO en la sala (window.__monedasAviso).
  const repartirMonedas = async (evento, partidoId) => {
    try {
      const permitidos = await EloSalasModel.conCuenta(evento);
      const tieneCuenta = (j) => j.verificado === true && permitidos.has(String(j.nombre || "").trim().toLowerCase());
      const premios = await MonedasModel.porPartido(evento, { sala: salaElegida || null, partidoId, puedeCobrar: tieneCuenta });
      if (!premios.length) return;
      const resumen = premios.map((p) => `${p.nombre} +${MonedasModel.enMonedas(p.total)}`).join(" · ");
      agregarMensaje("monedas", `🪙 Monedas: ${resumen}`);
      console.log(`🪙 Monedas repartidas — ${resumen}`);
      await frame.evaluate((lista) => window.__monedasAviso && window.__monedasAviso(lista), premios).catch(() => {});
      await refrescarMonedas();
    } catch (error) {
      console.warn(`⚠️ Las monedas no se repartieron: ${String(error.message).split("\n")[0]}`);
    }
  };

  // El saldo de los que están en la sala, para que !monedas conteste sin consultar la base
  const refrescarMonedas = async () => {
    try {
      const jugadores = await frame.evaluate(() => (window.__sala ? window.__sala.getPlayerList().map((j) => j.name) : []));
      if (!jugadores || !jugadores.length) return;
      const saldos = {};
      for (const nombre of jugadores) saldos[String(nombre).toLowerCase()] = await MonedasModel.saldo(nombre);
      await frame.evaluate((d) => { window.__MONEDAS = d; }, saldos);
    } catch (error) {
      // Sin base no pasa nada: !monedas contesta que todavía no tiene monedas
    }
  };

  // Resultado de un partido: actualiza el ELO, lo guarda y le devuelve la tabla a la sala
  // Cada partido mueve SOLO el ELO de esta sala (tabla elo_<sala>); el general lo recalcula el
  // procedimiento actualizar_elo_general() de la base (ver models/EloSalasModel.js). Sin base, lo
  // mismo sobre los archivos. Lo que se anuncia en la sala es el cambio del ELO de la sala.
  // SOLO suman los que tienen cuenta en la tabla usuarios y pusieron su clave: sin base, nadie.
  const procesarPartidoElo = async (evento) => {
    let cambiosSala;
    let eloGeneral = {};
    let sinCuenta = [];
    try {
      if (!ambitoSala || !EloSalasModel.tieneTabla(ambitoSala)) {
        // Una sala sin tabla propia (hosts/*.json nuevo): solo el general, con el mismo filtro de cuentas
        const permitidos = await EloSalasModel.conCuenta(evento);
        const tieneCuenta = (j) => j.verificado === true && permitidos.has(String(j.nombre || "").trim().toLowerCase());
        sinCuenta = [...evento.red, ...evento.blue].filter((j) => !tieneCuenta(j)).map((j) => j.nombre);
        const tabla = leerElo();
        cambiosSala = aplicarPartido(tabla, evento, { cuenta: tieneCuenta });
        if (cambiosSala.length) guardarElo(tabla);
      } else {
        const r = await EloSalasModel.procesarPartido(ambitoSala, evento);
        cambiosSala = r.cambios;
        eloGeneral = r.general;
        sinCuenta = r.sinCuenta || [];
        if (!r.enBase) console.warn("⚠️ La base no responde: no se puede confirmar quién tiene cuenta, este partido no suma ELO");
      }
    } catch (error) {
      console.error("❌ No se pudo actualizar el ELO:", error.message);
      return;
    }
    const avisoSinCuenta = sinCuenta.length
      ? `🔐 No sumaron (sin cuenta o sin !clave): ${sinCuenta.join(", ")} — creá tu cuenta en la web para sumar ELO`
      : null;
    if (!cambiosSala.length) {
      if (avisoSinCuenta) frame.evaluate((t) => window.__sala && window.__sala.sendAnnouncement(t, null, 0xFFD100, "small", 0), avisoSinCuenta).catch(() => {});
      return;
    }
    estado.elo = ranking(leerElo(ambitoSala), 50);

    frame.evaluate((datos) => window.__eloActualizar && window.__eloActualizar(datos), eloParaLaPagina()).catch(() => {});

    const resumen = cambiosSala
      .sort((a, b) => b.delta - a.delta)
      .map((c) => `${c.nombre} ${c.delta >= 0 ? "+" : ""}${c.delta}`)
      .join(" · ");
    agregarMensaje("elo", `Puntajes: ${resumen}`);
    console.log(`📊 ELO actualizado — ${resumen}`);

    // Y a la base: usuarios, partido y participaciones. Si está apagada, queda solo en elo.json
    PartidoModel.guardar(evento, cambiosSala, { clave: salaElegida || "sala", nombre: hostConfig.NombreHost || salaElegida || "sala" }, eloGeneral)
      .then((p) => {
        if (p) console.log(`💾 Partido #${p.id} guardado en la base`);
        return repartirMonedas(evento, p ? p.id : null).then(() => anotarRachas(evento));
      })
      .catch((error) => console.warn(`⚠️ El partido no se guardó en la base: ${String(error.message).split("\n")[0]}`));

    // Los que cambiaron de división se anuncian en la sala
    const anuncios = cambiosSala
      .filter((c) => c.subio || c.bajo)
      .map((c) => `${c.subio ? "⬆️" : "⬇️"} ${c.nombre} ahora es ${c.division.emoji} ${c.division.nombre}`);
    const lineas = [`📊 ${resumen}`, ...anuncios];
    if (avisoSinCuenta) lineas.push(avisoSinCuenta);
    frame
      .evaluate((textos) => {
        if (!window.__sala) return;
        for (const t of textos) window.__sala.sendAnnouncement(t, null, 0xFFD100, "bold", 0);
      }, lineas)
      .catch(() => {});
  };

  // Los rangos y su clave viajan a la página antes de correr el script.
  // WEBHOOK_SALA_ABIERTA es opcional: si está en .env, pisa al que trae script.js
  // (así la llave del webhook no queda escrita en un archivo que se sube a Git).
  await frame.evaluate((rangos, elo, webhookSala) => {
    window.__RANGOS = rangos;
    window.__ELO = elo;
    if (webhookSala) window.__WEBHOOK_SALA = webhookSala;
  }, leerRangos(), eloParaLaPagina(), process.env.WEBHOOK_SALA_ABIERTA || "");

  // Envuelve HBInit: agrega el token y engancha el puente del panel sin tocar el script
  await frame.evaluate((token, fuenteEspia) => {
    // lib/espia.js viaja como texto: en la página no hay require
    const crearSalaEspiada = new Function("return (" + fuenteEspia + ")")();

    window.__panelCola = [];
    const avisar = (evento) => {
      window.__panelCola.push(evento);
      if (window.__panelCola.length > 300) window.__panelCola.shift();
    };

    const originalHBInit = window.HBInit;
    window.HBInit = (config) => {
      const sala = originalHBInit({ ...config, token });
      window.__sala = sala;   // el panel puede pedir kick/ban desde acá

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

      // El espía del panel vive en lib/espia.js (así se puede probar en Node).
      // Mira los eventos sin reemplazar los handlers del script.
      return crearSalaEspiada(sala, avisar);
    };
  }, token, crearSalaEspiada.toString());

  // Los nombres registrados van ANTES del script, así sabe a quién pedirle clave
  // desde el primero que entra. Si la base está apagada, la lista queda vacía.
  await refrescarUsuarios();

  // Los parámetros cambiados desde el panel (tabla parametros_sala) pisan a hosts/<sala>.json.
  // Si la base está apagada, la sala abre con lo del JSON, como siempre.
  const claveSala = salaElegida || "";
  try {
    if (claveSala) {
      const cambios = await ConfigModel.cambiosDeLaSala(claveSala);
      const { texto, aplicadas } = Parametros.aplicarAlScript(roomScript, cambios);
      new Function(texto);   // por las dudas: si algo rompe la sintaxis, se abre sin estos cambios
      roomScript = texto;
      if (aplicadas.length) console.log(`⚙️ Parámetros desde el panel: ${aplicadas.join(", ")}`);
      const inicial = await ConfigModel.paraLaSala(claveSala);
      await frame.evaluate((datos) => { window.__CONFIG_INICIAL = datos; }, inicial);
    }
  } catch (error) {
    console.warn("⚠️ No se leyeron los parámetros de la base (se usa hosts/*.json): " + String(error.message).split("\n")[0]);
  }

  // El ELO: la base manda sobre los archivos espejo (si se jugó con la base apagada, se sube)
  try {
    const { subidas } = await EloSalasModel.sincronizar();
    if (subidas) console.log(`📊 ELO: subí a la base ${subidas} fichas que estaban solo en los archivos`);
    await frame.evaluate((datos) => { window.__ELO = datos; }, eloParaLaPagina());
  } catch (error) {
    console.warn("⚠️ ELO sin base: se usan los archivos (" + String(error.message).split("\n")[0] + ")");
  }

  // Si el script nunca asigna un handler espiado, igual lo enganchamos al arrancar
  await frame.evaluate(roomScript);
  console.log("✅ script.js cargado. Esperando el link de la sala...");

  // Alguien puede registrarse desde otra sala: refrescamos la lista cada tanto
  setInterval(refrescarUsuarios, 15000);   // un ban desde la web tarda como mucho esto en llegar

  // Los rangos se revisan seguido: es lo que deshace cualquier admin puesto a mano
  const SEGUNDOS_RANGOS = Number(process.env.SEGUNDOS_RANGOS || 5);
  await refrescarRangos();
  setInterval(refrescarRangos, SEGUNDOS_RANGOS * 1000);

  // Parámetros y comandos apagados desde el panel: la sala aplica solo lo que cambió
  let avisamosConfigCaida = false;
  // Las camisetas y los clásicos: se editan en el panel (Equipos) y la sala los toma en vivo
  let avisamosEquiposCaidos = false;
  const refrescarEquipos = async () => {
    try {
      const datos = await EquiposModel.paraLaSala();
      avisamosEquiposCaidos = false;
      await frame.evaluate((d) => { if (window.__equiposSala) window.__equiposSala(d); }, datos);
    } catch (error) {
      if (!avisamosEquiposCaidos) console.warn("⚠️ No se pudieron leer las camisetas de la base: la sala usa las suyas");
      avisamosEquiposCaidos = true;
    }
  };

  // Las camisetas compradas: qué tiene cada uno y cuál se puso (tienda de la web)
  const refrescarCamisetas = async () => {
    try {
      const nombres = await frame.evaluate(() => (window.__sala ? window.__sala.getPlayerList().map((j) => j.name) : []));
      const [puestas, compradas] = await Promise.all([TiendaModel.paraLaSala(), TiendaModel.deVariasCuentas(nombres)]);
      await frame.evaluate((p, c) => { window.__CAMISETA_PUESTA = p; window.__MIS_CAMISETAS = c; }, puestas, compradas);
    } catch (error) {
      // Sin base no pasa nada: !camisetas avisa que todavía no tiene ninguna
    }
  };

  const refrescarConfig = async () => {
    if (!claveSala) return;
    try {
      const datos = await ConfigModel.paraLaSala(claveSala);
      avisamosConfigCaida = false;
      await frame.evaluate((d) => { if (window.__configSala) window.__configSala(d); }, datos);
    } catch (error) {
      if (!avisamosConfigCaida) {
        const motivo = String(error.message).split("\n")[0];
        console.warn("⚠️ No se pudo leer la configuración de la base: la sala sigue con la que tiene (" + motivo + ")");
        agregarMensaje("config", "⚠️ La sala no pudo leer la configuración de la web: " + motivo);
      }
      avisamosConfigCaida = true;
    }
  };
  setInterval(refrescarConfig, SEGUNDOS_RANGOS * 1000);

  await refrescarEquipos();
  setInterval(refrescarEquipos, 30000);   // las camisetas no cambian tan seguido
  await refrescarCamisetas();
  setInterval(refrescarCamisetas, 20000);

  // El link de la web puede aparecer después (el túnel tarda unos segundos en abrir)
  await refrescarLinkWeb();
  setInterval(refrescarLinkWeb, 10000);

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
