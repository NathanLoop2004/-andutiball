// Saca Ñandutí Web de localhost con un túnel de Cloudflare y avisa el link en el Discord.
//
//   npm run tunel            abre el túnel al panel (puerto 8080)
//   npm run tunel -- 3001    a otro puerto
//
// El link de Cloudflare cambia en cada arranque, así que en el Discord se publica UN SOLO
// mensaje y después se edita ese mismo (ver services/WebhookWeb.js). Al cortar con Ctrl+C
// el mensaje queda avisando que está apagada.
//
// cloudflared tiene que estar instalado:
//   winget install Cloudflare.cloudflared
// Si está en otro lado, se le pasa la ruta con CLOUDFLARED_BIN en .env.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const WebhookWeb = require("./services/WebhookWeb");

const PUERTO = Number(process.argv[2] || process.env.TUNEL_PUERTO || process.env.PANEL_PORT || 8080);

const DONDE_BUSCAR = [
  process.env.CLOUDFLARED_BIN,
  "cloudflared",
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
  "/usr/local/bin/cloudflared",
  "/usr/bin/cloudflared",
].filter(Boolean);

function buscarCloudflared() {
  for (const ruta of DONDE_BUSCAR) {
    if (ruta === "cloudflared") continue;              // el del PATH lo probamos al final
    try { if (fs.existsSync(ruta)) return ruta; } catch (error) { /* seguimos */ }
  }
  return "cloudflared";
}

const GRIS = "\x1b[90m";
const RESET = "\x1b[0m";
const log = (texto) => console.log("🌐 " + texto);

let urlPublica = null;
let cortando = false;

const cloudflared = buscarCloudflared();

// Hay dos formas de abrir el túnel:
//
//   1. CON DOMINIO PROPIO (lo que usamos ahora): un túnel con nombre, hecho en Cloudflare.
//      El link NUNCA cambia. Se configura con una de estas dos en .env:
//        TUNEL_TOKEN=eyJhIjoi...        (Zero Trust → Networks → Tunnels → el token que te da)
//        TUNEL_NOMBRE=nandutihax        (si lo creaste por consola con "cloudflared tunnel create")
//      Y WEB_URL con la dirección final (https://nandutihax.com), que es la que se muestra.
//
//   2. SIN NADA (como antes): un "quick tunnel", que da una dirección al azar de
//      trycloudflare.com y cambia en cada arranque.
const TUNEL_TOKEN = (process.env.TUNEL_TOKEN || process.env.CLOUDFLARE_TUNNEL_TOKEN || "").trim();
const TUNEL_NOMBRE = (process.env.TUNEL_NOMBRE || "").trim();
const WEB_URL = (process.env.WEB_URL || "").trim().replace(/\/$/, "");
const conDominio = Boolean(TUNEL_TOKEN || TUNEL_NOMBRE);

const argumentos = TUNEL_TOKEN
  ? ["tunnel", "--no-autoupdate", "run", "--token", TUNEL_TOKEN]
  : TUNEL_NOMBRE
    ? ["tunnel", "--no-autoupdate", "run", "--url", `http://localhost:${PUERTO}`, TUNEL_NOMBRE]
    : ["tunnel", "--url", `http://localhost:${PUERTO}`, "--no-autoupdate"];

log(`Abriendo el túnel a http://localhost:${PUERTO} …`);
log(`${GRIS}cloudflared: ${cloudflared}${RESET}`);
if (conDominio) {
  log(`Túnel con dominio propio${WEB_URL ? ": " + WEB_URL : ""}`);
  if (!WEB_URL) log(`${GRIS}⚠️ Poné WEB_URL en .env (por ejemplo https://nandutihax.com) para que los links salgan bien${RESET}`);
}

// Si Cloudflare rechaza el token (se rehizo o se borró el túnel), no dejamos la web adentro:
// se avisa y se abre una dirección al azar, como antes, hasta que se ponga el token nuevo.
let conDominioAhora = conDominio;
let yaPasamosAlAzar = false;
let cambiandoDeTunel = false;   // true mientras cerramos uno a propósito para abrir el otro
let proceso = null;

function abrirCloudflared(args) {
  proceso = spawn(cloudflared, args, { stdio: ["ignore", "pipe", "pipe"] });

  proceso.on("error", (error) => {
    console.error("\n❌ No se pudo correr cloudflared: " + error.message);
    console.error("   👉 Instalalo con:  winget install Cloudflare.cloudflared");
    console.error("   👉 O poné la ruta del ejecutable en CLOUDFLARED_BIN (.env)\n");
    process.exit(1);
  });

  proceso.stdout.on("data", mirar);
  proceso.stderr.on("data", mirar);
  return proceso;
}

function pasarAlAzar(motivo) {
  if (yaPasamosAlAzar || !conDominioAhora) return;
  yaPasamosAlAzar = true;
  conDominioAhora = false;
  log(`⚠️ Cloudflare rechazó el túnel con dominio: ${motivo}.`);
  log(`${GRIS}   El TUNEL_TOKEN de .env ya no sirve (se rehizo o se borró el túnel).${RESET}`);
  log(`${GRIS}   Mientras tanto se abre una dirección al azar, para no dejar la web adentro.${RESET}`);
  cambiandoDeTunel = true;
  try { proceso.kill(); } catch (error) { /* ya estaba muerto */ }
  setTimeout(() => {
    vigilarSalida(abrirCloudflared(["tunnel", "--url", `http://localhost:${PUERTO}`, "--no-autoupdate"]));
    cambiandoDeTunel = false;
  }, 1500);
}

// cloudflared escribe casi todo por stderr; el link sale en una de esas líneas
const mirar = (texto) => {
  // Con dominio propio la dirección la sabemos de antemano (WEB_URL): se avisa cuando el túnel
  // dice que ya está conectado. Con el túnel al azar, el link sale en una de estas líneas.
  if (/Invalid tunnel secret|tunnel not found|Unauthorized/i.test(texto)) pasarAlAzar("el token no sirve");

  if (conDominioAhora) {
    if (!urlPublica && WEB_URL && /Registered tunnel connection|Connection .* registered/i.test(texto)) {
      urlPublica = WEB_URL;
      avisar({ url: urlPublica, estado: "arriba" });
    }
  } else {
    const encontrado = String(texto).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (encontrado && encontrado[0] !== urlPublica) {
      urlPublica = encontrado[0];
      avisar({ url: urlPublica, estado: "arriba" });
    }
  }
  // Los errores de verdad sí se muestran; el resto es ruido
  if (/ERR|error=/i.test(texto) && !/no-autoupdate/i.test(texto)) {
    process.stdout.write(GRIS + String(texto).trim().slice(0, 300) + RESET + "\n");
  }
};

abrirCloudflared(argumentos);

async function avisar(datos) {
  if (datos.estado === "arriba") {
    log("Ñandutí Web está afuera de localhost:");
    console.log("   👉 " + datos.url + "\n");
  }
  if (!WebhookWeb.hayWebhook()) {
    log(`${GRIS}(sin WEBHOOK_WEB en .env no se avisa al Discord)${RESET}`);
    return;
  }
  try {
    const { editado } = await WebhookWeb.publicar(datos);
    log(`${GRIS}Discord: ${editado ? "mensaje actualizado" : "mensaje publicado"}${RESET}`);
  } catch (error) {
    console.error("⚠️ No se pudo avisar al Discord: " + error.message);
  }
}

// Al cortar, el mensaje del Discord queda diciendo que está apagada
async function cortar() {
  if (cortando) return;
  cortando = true;
  log("Cerrando el túnel…");
  try { proceso.kill(); } catch (error) { /* ya estaba muerto */ }
  if (urlPublica) await avisar({ estado: "abajo" });
  process.exit(0);
}

process.on("SIGINT", cortar);
process.on("SIGTERM", cortar);

function vigilarSalida(hijo) {
  hijo.on("exit", async (codigo) => {
    // Si lo cerramos nosotros para pasar al túnel al azar, no es una caída
    if (cortando || cambiandoDeTunel || hijo !== proceso) return;
    console.error(`\n❌ cloudflared se cerró (código ${codigo}).`);
    if (urlPublica) await avisar({ estado: "problema", nota: "El túnel se cortó. Cuando vuelva, este mensaje se actualiza." });
    process.exit(codigo || 1);
  });
}

vigilarSalida(proceso);

