// Cuánto trabajo hace la extensión en el navegador del jugador:  npm run medir-extension
// Lo que SÍ se puede medir sin que el ruido de la máquina lo tape: cuántos pedidos hace la
// extensión, cuántas veces redibuja el panel y cuánta memoria de JavaScript usa.
const fs = require("fs");
const puppeteer = require("C:/Users/eborja/Desktop/script haxball/node_modules/puppeteer");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const SEGUNDOS = Number(process.env.SEGUNDOS || 40);

async function medir(nombre, archivo) {
  const navegador = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const p = await navegador.newPage();
  let pedidos = 0;
  p.on("request", (r) => { if (/nandutihax\.com\/api/.test(r.url())) pedidos++; });
  await p.evaluateOnNewDocument(fs.readFileSync(archivo, "utf8"));
  // Contamos cuántas veces se rehace el panel (cambios en el DOM adentro del panel)
  await p.evaluateOnNewDocument(() => {
    window.__redibujos = 0;
    document.addEventListener("DOMContentLoaded", () => {
      const mirar = () => {
        const panel = document.getElementById("nh-panel");
        if (!panel) return setTimeout(mirar, 300);
        new MutationObserver((cambios) => { window.__redibujos += cambios.length; })
          .observe(panel, { childList: true, subtree: true, characterData: true });
      };
      mirar();
    });
  });
  await p.goto("https://www.haxball.com/play", { waitUntil: "domcontentloaded", timeout: 60000 });
  await esperar(SEGUNDOS * 1000);
  const m = await p.metrics();
  const redibujos = await p.evaluate(() => window.__redibujos || 0);
  console.log(nombre.padEnd(16),
    String(pedidos).padStart(3) + " pedidos  ",
    String(redibujos).padStart(4) + " cambios en el panel  ",
    (Math.round(m.JSHeapUsedSize / 104857.6) / 10) + " MB de JavaScript  ",
    m.Nodes + " nodos");
  await navegador.close();
}

(async () => {
  console.log("En " + SEGUNDOS + " segundos, fuera de una sala de ÑandutíHax:\n");
  await medir("1.5.1 (antes)", __dirname + "/version-antes.js");
  await medir("1.6.0 (ahora)", "C:/Users/eborja/Desktop/script haxball/public/nandutihax.user.js");
})();
