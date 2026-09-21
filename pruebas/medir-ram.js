// ¿Cuánta RAM se lleva una sala?  npm run medir-ram
//
// Abre la página del host headless con las opciones de hoy y
// con unas más livianas, y compara. Se mide TODO el árbol de procesos del navegador, que es
// lo que se ve en el Administrador de tareas.
const puppeteer = require("C:/Users/eborja/Desktop/script haxball/node_modules/puppeteer");
const { execSync } = require("child_process");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Suma la memoria (MB) del proceso y de todos sus hijos. Se le pide a Windows la lista de
// procesos una sola vez (en CSV) y el árbol se recorre acá: meter un script largo de
// PowerShell en una línea se rompe solo.
function ramDelArbol(pid) {
  const salida = execSync(
    'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Csv -NoTypeInformation"'
  ).toString();
  const procesos = salida.split(/\r?\n/).slice(1).map((linea) => {
    const c = linea.trim().replace(/"/g, "").split(",");
    return { pid: Number(c[0]), padre: Number(c[1]), bytes: Number(c[2]) };
  }).filter((p) => p.pid);

  const porPadre = new Map();
  const porPid = new Map();
  for (const p of procesos) {
    porPid.set(p.pid, p);
    if (!porPadre.has(p.padre)) porPadre.set(p.padre, []);
    porPadre.get(p.padre).push(p.pid);
  }

  let total = 0;
  const pendientes = [pid];
  const vistos = new Set();
  while (pendientes.length) {
    const actual = pendientes.pop();
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    if (porPid.has(actual)) total += porPid.get(actual).bytes;
    for (const hijo of porPadre.get(actual) || []) pendientes.push(hijo);
  }
  return Math.round(total / 1048576);
}

const DE_HOY = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-features=WebRtcHideLocalIpsWithMdns",
];

// Más livianas: sin GPU, sin imágenes (la página del host no muestra ningún partido), sin
// sonido, sin extensiones ni servicios de fondo, y con menos memoria para JavaScript.
const LIVIANAS = DE_HOY.concat([
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--blink-settings=imagesEnabled=false",
  "--mute-audio",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
  "--metrics-recording-only",
  "--js-flags=--max-old-space-size=192",
  "--renderer-process-limit=1",
  "--disk-cache-size=1048576",
]);

(async () => {
  for (const [nombre, args] of [["como está hoy", DE_HOY], ["más liviano", LIVIANAS]]) {
    const navegador = await puppeteer.launch({ headless: true, args });
    const pagina = await navegador.newPage();
    await pagina.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2", timeout: 60000 });
    await esperar(12000);                        // que termine de acomodarse
    const mb = ramDelArbol(navegador.process().pid);
    const js = await pagina.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
    console.log(nombre.padEnd(16), mb + " MB de RAM" + (js ? "   (JavaScript: " + js + " MB)" : ""));
    await navegador.close();
    await esperar(1500);
  }
})();
