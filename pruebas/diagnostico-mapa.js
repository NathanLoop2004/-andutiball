// Diagnóstico rápido: prueba variantes del mapa para ver qué rechaza HaxBall.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

(async () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mapas", "nanduti-futsal-x3.hbs"), "utf8"));
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });
  const f = p.frames().find((x) => x.url().includes("html5.haxball.com")) || p.mainFrame();
  await f.waitForFunction("typeof HBInit === 'function'", { timeout: 30000 });
  await f.evaluate(() => { window.__s = HBInit({ roomName: "t", noPlayer: true }); });

  const probar = async (nombre, mapa) => {
    const e = await f.evaluate((t) => {
      try { window.__s.setCustomStadium(t); return null; }
      catch (x) { return String(x && (x.message || x)) + " | " + (x && x.stack ? x.stack.split("\n")[0] : ""); }
    }, JSON.stringify(mapa));
    console.log(`${nombre.padEnd(22)} -> ${e || "OK"}`);
  };

  await probar("completo", m);
  await probar("discs <= 15", { ...m, discs: m.discs.slice(0, 15) });
  await probar("discs <= 60", { ...m, discs: m.discs.slice(0, 60) });
  await probar("discs <= 100", { ...m, discs: m.discs.slice(0, 100) });
  await probar("segments <= 100", { ...m, segments: m.segments.slice(0, 100) });
  await probar("segments <= 150", { ...m, segments: m.segments.slice(0, 150) });
  await probar("segments <= 200", { ...m, segments: m.segments.slice(0, 200) });
  await probar("vertexes recortados", { ...m, vertexes: m.vertexes.slice(0, 255), segments: m.segments.filter((s) => s.v0 < 255 && s.v1 < 255) });

  await b.close();
})();
