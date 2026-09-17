// Ñandutí Web: la página, el panel y el túnel de Cloudflare, APARTE de las salas.
//
//   npm run web          la levanta en esta terminal (Ctrl+C la corta)
//   npm run web:bajar    apaga la que quedó prendida en segundo plano
//   npm run web:estado   dice si está prendida y cuál es el link
//
// ¿Por qué aparte? El link del túnel rápido de Cloudflare cambia cada vez que el túnel arranca.
// Antes el túnel se prendía y se apagaba junto con las salas, y como las salas se reinician
// seguido (los tokens de HaxBall vencen), el link cambiaba a cada rato: se rompían los links
// del mail de recuperación y los que la gente guardó. Ahora "npm start" deja la web prendida
// en segundo plano la primera vez, y las salas se pueden reiniciar sin tocar el link.
//
// Si el túnel o el panel se caen, se vuelven a prender solos. Si el túnel vuelve con otro
// link, el Discord se actualiza (tunel.js) y las salas lo toman solas (lo leen cada 10 s).

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { parseEnv } = require("util");
const { spawn, spawnSync } = require("child_process");
const { ultimoCambio } = require("./lib/preparar");

const PANEL_PORT = Number(process.env.PANEL_PORT || 8080);
const DATOS = path.join(__dirname, "datos");
const ARCHIVO_PID = path.join(DATOS, "web.pid");
const ARCHIVO_LOG = path.join(DATOS, "web.log");
const ARCHIVO_FIRMA = path.join(DATOS, "web.firma");       // con qué código y .env arrancó el panel
const ARCHIVO_RECARGA = path.join(DATOS, "web.recargar"); // npm start lo deja para recargar el panel
const ARCHIVO_TUNEL = process.env.TUNEL_FILE || path.join(DATOS, "tunel.json");

// Las 4 salas, siempre: el panel muestra apagada la que no esté corriendo
const SALAS = [
  "3v3|Futsal 3v3|http://localhost:3001",
  "4v4|Futsal 4v4|http://localhost:3002",
  "todos|Futsal automático|http://localhost:3003",
  "realsoccer|Real Soccer|http://localhost:3004",
].join(",");

const conTunel = () => !/^(no|false|0)$/i.test(String(process.env.TUNEL_WEB ?? "si").trim());

// Sin colores cuando la salida va al archivo de log (segundo plano)
const GRIS = process.stdout.isTTY ? "\x1b[90m" : "";
const RESET = process.stdout.isTTY ? "\x1b[0m" : "";

// ── Recargar el panel sin cortar el túnel ──
// Si cambió el código de la web o el .env, npm start pide recargar SOLO el panel: el túnel sigue
// igual y el link público no cambia.

// El .env tal cual está ahora (el proceso de la web arrancó con el de antes)
function envFresco() {
  try { return parseEnv(fs.readFileSync(path.join(__dirname, ".env"), "utf8")); } catch (error) { return {}; }
}

// Una huella del código del panel y del .env: si cambia algo, hay que recargarlo
function firmaDelPanel() {
  const cambios = ["app.js", "package-lock.json", "routes", "controllers", "models", "services", "lib", "middlewares", "panel", "node_modules/.prisma/client"]
    .map((r) => Math.round(ultimoCambio(path.join(__dirname, r))))
    .join(",");
  const env = (() => { try { return fs.readFileSync(path.join(__dirname, ".env"), "utf8"); } catch (error) { return ""; } })();
  return crypto.createHash("sha1").update(cambios + "|" + env).digest("hex");
}

const firmaConLaQueArranco = () => { try { return fs.readFileSync(ARCHIVO_FIRMA, "utf8").trim(); } catch (error) { return ""; } };

function pedirRecarga() {
  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(ARCHIVO_RECARGA, String(Date.now()));
}

// ── ¿Está prendida? ──

function pidGuardado() {
  try {
    const pid = Number.parseInt(fs.readFileSync(ARCHIVO_PID, "utf8"), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    return null;
  }
}

function procesoVivo(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function contestaElPanel(puerto = PANEL_PORT, ms = 2000) {
  return new Promise((listo) => {
    const pedido = http.get({ host: "127.0.0.1", port: puerto, path: "/", timeout: ms }, (res) => {
      res.resume();
      listo(true);
    });
    pedido.on("timeout", () => { pedido.destroy(); listo(false); });
    pedido.on("error", () => listo(false));
  });
}

function linkPublico() {
  try {
    const t = JSON.parse(fs.readFileSync(ARCHIVO_TUNEL, "utf8"));
    return t.estado === "arriba" ? t.url : null;
  } catch (error) {
    return null;
  }
}

// { prendida, pid, panel }
async function estado() {
  const pid = pidGuardado();
  return { prendida: procesoVivo(pid), pid, panel: await contestaElPanel() };
}

// Deja la web corriendo en segundo plano (la usa npm start). No espera a que termine.
function prenderEnSegundoPlano() {
  fs.mkdirSync(DATOS, { recursive: true });
  const salida = fs.openSync(ARCHIVO_LOG, "a");
  const hijo = spawn(process.execPath, [__filename, "--supervisor"], {
    cwd: __dirname,
    env: process.env,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", salida, salida],
  });
  hijo.unref();
  fs.closeSync(salida);
  return hijo.pid;
}

// Mata al supervisor y a todo lo que cuelga de él (panel, tunel.js y cloudflared)
function matarArbol(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    try { process.kill(-pid, "SIGTERM"); } catch (error) { try { process.kill(pid, "SIGTERM"); } catch (e) { /* ya no estaba */ } }
  }
}

async function bajar() {
  const pid = pidGuardado();
  if (!procesoVivo(pid)) {
    console.log("💤 Ñandutí Web no estaba prendida en segundo plano.");
    if (await contestaElPanel()) console.log(`${GRIS}   (el puerto ${PANEL_PORT} contesta: hay otra web corriendo en alguna terminal, cortala con Ctrl+C)${RESET}`);
    try { fs.unlinkSync(ARCHIVO_PID); } catch (error) { /* no había */ }
    return;
  }
  matarArbol(pid);
  try { fs.unlinkSync(ARCHIVO_PID); } catch (error) { /* ya no está */ }
  console.log("👋 Ñandutí Web apagada.");

  // taskkill /F no deja que tunel.js avise: el mensaje del Discord lo dejamos acá
  const WebhookWeb = require("./services/WebhookWeb");
  const guardado = WebhookWeb.leerGuardado();
  if (WebhookWeb.hayWebhook() && guardado.mensajeId && guardado.estado !== "abajo") {
    try {
      await WebhookWeb.publicar({ estado: "abajo" });
      console.log(`${GRIS}   Discord: el mensaje quedó diciendo que la web está apagada${RESET}`);
    } catch (error) {
      console.error("⚠️ No se pudo avisar al Discord: " + error.message);
    }
  }
}

// ── El supervisor: prende el panel y el túnel, y los levanta de nuevo si se caen ──

function supervisar() {
  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(ARCHIVO_PID, String(process.pid));

  const hijos = new Map();
  const recargas = new Map();   // nombre → función que lo vuelve a prender al toque
  let cerrando = false;
  const hora = () => new Date().toLocaleTimeString("es-PY");

  function lanzar(nombre, archivo, variables) {
    const intentos = { cuenta: 0, desde: Date.now() };
    let recargando = false;

    const arrancar = () => {
      // El .env se relee en cada arranque: así una recarga toma lo que se cambió
      if (nombre === "panel") fs.writeFileSync(ARCHIVO_FIRMA, firmaDelPanel());
      const hijo = spawn(process.execPath, [path.join(__dirname, archivo)], {
        cwd: __dirname,
        env: { ...process.env, ...envFresco(), ...variables },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      hijos.set(nombre, hijo);

      const mostrar = (datos) => {
        for (const linea of String(datos).split("\n")) {
          if (linea.trim()) console.log(`${GRIS}${hora()}${RESET} [${nombre}] ${linea}`);
        }
      };
      hijo.stdout.on("data", mostrar);
      hijo.stderr.on("data", mostrar);

      hijo.on("exit", (codigo) => {
        hijos.delete(nombre);
        if (cerrando) return;
        if (recargando) {
          recargando = false;
          console.log(`${GRIS}${hora()}${RESET} [${nombre}] recargado con el código y el .env nuevos`);
          return arrancar();
        }
        // Si se cae seguido, esperamos cada vez más (5 s, 10 s, … hasta 1 minuto)
        if (Date.now() - intentos.desde > 10 * 60 * 1000) { intentos.cuenta = 0; intentos.desde = Date.now(); }
        intentos.cuenta++;
        const espera = Math.min(5000 * intentos.cuenta, 60000);
        console.log(`${GRIS}${hora()}${RESET} [${nombre}] se cerró (código ${codigo}), lo vuelvo a prender en ${espera / 1000}s`);
        setTimeout(() => { if (!cerrando) arrancar(); }, espera);
      });
    };

    recargas.set(nombre, () => {
      const hijo = hijos.get(nombre);
      if (!hijo) return;
      recargando = true;
      try { hijo.kill(); } catch (error) { recargando = false; }
    });

    arrancar();
  }

  console.log(`\n🕸️  ${hora()} Ñandutí Web arrancando (pid ${process.pid})`);
  lanzar("panel", "panel/server.js", { PANEL_PORT: String(PANEL_PORT), SALAS });
  if (conTunel()) lanzar("tunel", "tunel.js", { TUNEL_PUERTO: String(PANEL_PORT) });

  // npm start deja datos/web.recargar cuando cambió el código de la web o el .env
  setInterval(() => {
    if (cerrando || !fs.existsSync(ARCHIVO_RECARGA)) return;
    try { fs.unlinkSync(ARCHIVO_RECARGA); } catch (error) { return; }
    console.log(`${GRIS}${hora()}${RESET} Recargando el panel (el túnel sigue igual)…`);
    const recargar = recargas.get("panel");
    if (recargar) recargar();
  }, 1000);

  const cerrar = () => {
    if (cerrando) return;
    cerrando = true;
    console.log(`\n👋 ${hora()} Cerrando Ñandutí Web…`);
    for (const hijo of hijos.values()) { try { hijo.kill("SIGINT"); } catch (error) { /* ya estaba */ } }
    // Le damos tiempo a tunel.js para dejar el aviso de apagada en el Discord
    setTimeout(() => {
      try { if (pidGuardado() === process.pid) fs.unlinkSync(ARCHIVO_PID); } catch (error) { /* nada */ }
      process.exit(0);
    }, 3000);
  };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

module.exports = { estado, prenderEnSegundoPlano, contestaElPanel, linkPublico, firmaDelPanel, firmaConLaQueArranco, pedirRecarga, ARCHIVO_LOG, PANEL_PORT };

if (require.main === module) {
  const orden = process.argv[2];
  (async () => {
    if (orden === "--supervisor") return supervisar();

    if (orden === "bajar") return bajar();

    if (orden === "estado") {
      const e = await estado();
      if (e.prendida || e.panel) {
        console.log(`🟢 Ñandutí Web prendida${e.prendida ? ` en segundo plano (pid ${e.pid})` : " (en alguna terminal)"}`);
        console.log(`   Local:   http://localhost:${PANEL_PORT}`);
        const link = linkPublico();
        console.log(`   Público: ${link || GRIS + "(sin túnel todavía)" + RESET}`);
        console.log(`${GRIS}   Lo que va pasando: ${ARCHIVO_LOG}${RESET}`);
      } else {
        console.log("💤 Ñandutí Web está apagada.  👉 npm run web  (o npm start la prende sola)");
      }
      return;
    }

    // npm run web: en primer plano, en esta terminal
    const e = await estado();
    if (e.prendida || e.panel) {
      console.log(`🟢 Ñandutí Web ya está prendida${e.prendida ? ` en segundo plano (pid ${e.pid})` : ""}. No hace falta prenderla de nuevo.`);
      console.log(`${GRIS}   Para apagarla: npm run web:bajar${RESET}`);
      return;
    }
    supervisar();
  })();
}
