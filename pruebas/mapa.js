// Valida los .hbs de mapas/ cargándolos en HaxBall (Puppeteer + iframe headless).
// Un mapa mal armado hace que setCustomStadium() tire un error o que la sala no arranque.
//
//   npm run prueba-mapas

const fs = require("fs");
const path = require("path");

const CARPETA = path.join(__dirname, "..", "mapas");

async function validar() {
  const puppeteer = require("puppeteer");
  const archivos = fs.readdirSync(CARPETA).filter((a) => a.endsWith(".hbs"));
  if (!archivos.length) {
    console.error("❌ No hay .hbs en mapas/. Corré antes: npm run generar-mapas");
    process.exit(1);
  }

  // Primero validamos que cada archivo sea JSON válido (chequeo rápido antes de abrir Chrome)
  const mapas = [];
  for (const a of archivos) {
    const ruta = path.join(CARPETA, a);
    try {
      const json = JSON.parse(fs.readFileSync(ruta, "utf8"));
      mapas.push({ archivo: a, ruta, json });
      console.log(`✅ ${a} — JSON válido (${json.width}x${json.height})`);
    } catch (error) {
      console.error(`❌ ${a} — JSON inválido: ${error.message}`);
      process.exit(1);
    }
  }

  console.log("\n🌐 Abriendo HaxBall headless para validar cada mapa en el motor real...\n");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });
  const frame = page.frames().find((f) => f.url().includes("html5.haxball.com")) || page.mainFrame();
  await frame.waitForFunction("typeof HBInit === 'function'", { timeout: 30000 });

  // Creamos una sala fantasma solo para poder cargar mapas
  await frame.evaluate(() => {
    window.__salaValidadora = window.HBInit({ roomName: "validador", noPlayer: true });
  });

  let fallos = 0;
  for (const m of mapas) {
    const error = await frame.evaluate((textoMapa) => {
      try {
        window.__salaValidadora.setCustomStadium(textoMapa);
        return null;
      } catch (e) {
        return e.message || String(e);
      }
    }, JSON.stringify(m.json));
    if (error) {
      console.error(`❌ ${m.archivo} — HaxBall rechazó el mapa: ${error}`);
      fallos++;
    } else {
      console.log(`✅ ${m.archivo} — HaxBall lo aceptó`);
    }
  }

  await browser.close();

  console.log("");
  if (fallos) {
    console.error(`❌ ${fallos} mapa(s) con problemas. Revisá y volvé a generar.`);
    process.exit(1);
  }
  console.log("🎉 Todos los mapas son válidos y HaxBall los acepta.\n");
}

validar().catch((error) => {
  console.error("❌ Error inesperado:", error);
  process.exit(1);
});
