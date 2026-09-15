// Lanzador del host de HaxBall con Puppeteer.
// Abre la página headless, le pasa el token (para saltar el captcha) y ejecuta script.js.
//
// Uso:  pon HAXBALL_TOKEN en .env y corre "npm start" (o pásalo como variable de entorno)
// Token nuevo en https://www.haxball.com/headlesstoken (vence a los pocos minutos).

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const token = process.env.HAXBALL_TOKEN;
if (!token) {
  console.error("❌ Falta HAXBALL_TOKEN. Consíguelo en https://www.haxball.com/headlesstoken");
  process.exit(1);
}

const scriptPath = path.join(__dirname, "script.js");
let roomScript = fs.readFileSync(scriptPath, "utf8");

// HOST_CONFIG: JSON con variables de configuración de script.js que se reemplazan en esta sala
// (ej. hosts/3v3.json → { "NombreHost": "...", "MapaPorDefecto": "Futsal x3" })
const hostConfigPath = process.env.HOST_CONFIG;
if (hostConfigPath) {
  const overrides = JSON.parse(fs.readFileSync(path.resolve(__dirname, hostConfigPath), "utf8"));
  for (const [name, value] of Object.entries(overrides)) {
    const declaration = new RegExp(`^([ \\t]*)(var|let|const)\\s+${name}\\b[^;\\n]*;?`, "m");
    if (!declaration.test(roomScript)) {
      console.warn(`⚠️ ${hostConfigPath}: la variable "${name}" no existe en script.js, se ignora`);
      continue;
    }
    roomScript = roomScript.replace(declaration, (_, indent, keyword) => `${indent}${keyword} ${name} = ${JSON.stringify(value)};`);
  }
  console.log(`⚙️ Configuración aplicada: ${hostConfigPath} (${Object.keys(overrides).join(", ")})`);
}

// Verifica la sintaxis antes de abrir el navegador
try {
  new Function(roomScript);
} catch (error) {
  console.error("❌ script.js tiene un error de sintaxis:", error.message);
  process.exit(1);
}

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

  // Envuelve HBInit para agregar el token y avisar el link de la sala en la consola
  await frame.evaluate((token) => {
    const originalHBInit = window.HBInit;
    window.HBInit = (config) => {
      const room = originalHBInit({ ...config, token });
      const checkLink = setInterval(() => {
        const link = document.querySelector("#roomlink a");
        if (link) {
          console.log(`🔗 Sala abierta: ${link.href}`);
          clearInterval(checkLink);
        }
      }, 1000);
      return room;
    };
  }, token);

  await frame.evaluate(roomScript);
  console.log("✅ script.js cargado. Deja este proceso corriendo para mantener la sala abierta.");

  const shutdown = async () => {
    console.log("👋 Cerrando sala...");
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((error) => {
  console.error("❌ No se pudo iniciar la sala:", error);
  process.exit(1);
});
