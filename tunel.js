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
log(`Abriendo el túnel a http://localhost:${PUERTO} …`);
log(`${GRIS}cloudflared: ${cloudflared}${RESET}`);

const proceso = spawn(cloudflared, ["tunnel", "--url", `http://localhost:${PUERTO}`, "--no-autoupdate"], {
  stdio: ["ignore", "pipe", "pipe"],
});

proceso.on("error", (error) => {
  console.error("\n❌ No se pudo correr cloudflared: " + error.message);
  console.error("   👉 Instalalo con:  winget install Cloudflare.cloudflared");
  console.error("   👉 O poné la ruta del ejecutable en CLOUDFLARED_BIN (.env)\n");
  process.exit(1);
});

// cloudflared escribe casi todo por stderr; el link sale en una de esas líneas
const mirar = (texto) => {
  const encontrado = String(texto).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (encontrado && encontrado[0] !== urlPublica) {
    urlPublica = encontrado[0];
    avisar({ url: urlPublica, estado: "arriba" });
  }
  // Los errores de verdad sí se muestran; el resto es ruido
  if (/ERR|error=/i.test(texto) && !/no-autoupdate/i.test(texto)) {
    process.stdout.write(GRIS + String(texto).trim().slice(0, 300) + RESET + "\n");
  }
};

proceso.stdout.on("data", mirar);
proceso.stderr.on("data", mirar);

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

proceso.on("exit", async (codigo) => {
  if (cortando) return;
  console.error(`\n❌ cloudflared se cerró (código ${codigo}).`);
  if (urlPublica) await avisar({ estado: "problema", nota: "El túnel se cortó. Cuando vuelva, este mensaje se actualiza." });
  process.exit(codigo || 1);
});
