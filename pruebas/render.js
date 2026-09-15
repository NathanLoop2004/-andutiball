// Dibuja un .hbs como imagen PNG para revisar cómo se ve el mapa sin abrir una sala.
// Interpreta vertexes + segments (incluidas las curvas) igual que HaxBall.
//
//   node pruebas/render.js mapas/nanduti-futsal-x3.hbs salida.png [zoom]
//
// zoom: "logo" recorta al círculo central (para mirar el detalle del ñandutí).

const fs = require("fs");
const path = require("path");

const [, , archivoMapa, salida = "mapa.png", modo = ""] = process.argv;
if (!archivoMapa) {
  console.error("Uso: node pruebas/render.js <mapa.hbs> [salida.png] [logo]");
  process.exit(1);
}

const mapa = JSON.parse(fs.readFileSync(archivoMapa, "utf8"));

// HaxBall: 'curve' es el ángulo (en grados) que abarca el arco entre los dos vértices.
// Lo pasamos a un arco SVG: radio = cuerda / (2·sen(ángulo/2)).
function caminoSegmento(s, vertexes) {
  const a = vertexes[s.v0], b = vertexes[s.v1];
  if (!a || !b) return "";
  const curve = s.curve || 0;
  if (!curve) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const rad = (Math.abs(curve) * Math.PI) / 180;
  const cuerda = Math.hypot(b.x - a.x, b.y - a.y);
  const radio = cuerda / (2 * Math.sin(rad / 2));
  const largo = Math.abs(curve) > 180 ? 1 : 0;
  const sentido = curve > 0 ? 0 : 1;
  return `M ${a.x} ${a.y} A ${Math.abs(radio)} ${Math.abs(radio)} 0 ${largo} ${sentido} ${b.x} ${b.y}`;
}

const color = (c, porDefecto = "#000") => {
  if (c === undefined || c === null) return porDefecto;
  if (c === "transparent") return "none";
  const s = String(c);
  if (s === "0") return "#000000";
  return "#" + s.padStart(6, "0");
};

const W = mapa.width, H = mapa.height;
const esLogo = modo === "logo";
const vista = esLogo ? { x: -W * 0.22, y: -H * 0.5, w: W * 0.44, h: H } : { x: -W * 1.06, y: -H * 1.12, w: W * 2.12, h: H * 2.24 };

const fondo = mapa.bg || {};
const colorFondo = fondo.color ? color(fondo.color) : "#718C5A";

const partes = [];
for (const s of mapa.segments || []) {
  if (s.vis === false) continue;
  const d = caminoSegmento(s, mapa.vertexes || []);
  if (!d) continue;
  partes.push(`<path d="${d}" fill="none" stroke="${color(s.color, "#fff")}" stroke-width="2.4" stroke-linecap="round"/>`);
}
for (const d of mapa.discs || []) {
  if (!d.pos) continue;
  const r = d.radius || 5;
  partes.push(`<circle cx="${d.pos[0]}" cy="${d.pos[1]}" r="${r}" fill="${color(d.color, "#fff")}"/>`);
}
// La pelota (disco 0) casi nunca trae pos: va en el centro
const bola = (mapa.discs || [])[0];
if (bola && !bola.pos) {
  partes.push(`<circle cx="0" cy="0" r="${bola.radius || 6}" fill="${color(bola.color, "#fff")}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vista.x} ${vista.y} ${vista.w} ${vista.h}" width="1000">
  <rect x="${vista.x}" y="${vista.y}" width="${vista.w}" height="${vista.h}" fill="${colorFondo}"/>
  ${partes.join("\n  ")}
</svg>`;

(async () => {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  const elemento = await page.$("svg");
  await elemento.screenshot({ path: path.resolve(salida) });
  await browser.close();
  console.log(`🖼️  ${salida}  (${mapa.name})`);
})();
