// Genera los 4 mapas de ÑandutíBall (Futsal x3, x4, x5, x7) copiando los del script.js
// original y cambiándoles el nombre y la pelota (amarilla lisa).
//
// Los mapas del script.js son los del autor original: tienen paredes bien armadas,
// arcos con red, líneas de área, banderines de córner y física de futsal probada.
// Los copiamos tal cual porque están bien.
//
//   npm run generar-mapas          → escribe mapas/*.hbs
//   npm run generar-mapas -- --ver → solo muestra un preview

const fs = require("fs");
const path = require("path");

const SOLO_VER = process.argv.includes("--ver");
const RAIZ = path.join(__dirname, "..");
const SCRIPT_PATH = path.join(RAIZ, "script.js");
const script = fs.readFileSync(SCRIPT_PATH, "utf8");

const MAPAS = [
  { clave: "x3", funcion: "getFutx3Map", nombreNuevo: "🕸️ ÑandutíBall Futsal x3 🇵🇾" },
  { clave: "x4", funcion: "getFutx4Map", nombreNuevo: "🕸️ ÑandutíBall Futsal x4 🇵🇾" },
  { clave: "x5", funcion: "getFutx5Map", nombreNuevo: "🕸️ ÑandutíBall Futsal x5 🇵🇾" },
  { clave: "x7", funcion: "getFutx7Map", nombreNuevo: "🕸️ ÑandutíBall Futsal x7 🇵🇾" },
];

// Los mapas del script tienen ${PelotaFutsal} y ${JSON.stringify(obtenerDiscos()).slice(1, -1)}
// La pelota va amarilla lisa. Igual generamos los discos decorativos de la pelota "oveja"
// (las pintitas negras) y después pintarPelota() los saca CON sus joints: el template trae
// joints que los atan a la pelota, y si se borran los discos sin borrar los joints, esos
// joints terminan atando la pelota a los postes del arco.
const PELOTA_COLOR = "FFD700";
const DISCOS_OVEJA = [
  { pos: [-5, -1], radius: 0.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
  { pos: [5, -1], radius: 0.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
  { pos: [0, -5], radius: 0.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
  { pos: [-3, 4], radius: 0.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
  { pos: [3, 4], radius: 0.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
  { radius: 1.7, invMass: 1e+300, color: "0", cMask: [], cGroup: [] },
];

// Pelota amarilla lisa y un 10% más chica.
// Los discos decorativos ya no se generan (ver PELOTA_COLOR), pero si el mapa de origen
// trajera alguno, lo sacamos igual junto con los joints que lo sujetaban. Al borrar discos
// hay que correr los índices de los joints que apuntan a discos posteriores.
function pintarPelota(mapa) {
  const bola = mapa.discs && mapa.discs[0];
  if (!bola) return;
  bola.color = "FFD700";
  bola.radius = +(bola.radius * 0.9).toFixed(3);

  // Un disco es "pintita" si no choca con nada (cMask vacío) y es negro
  const sobra = (d, i) => i > 0 && Array.isArray(d.cMask) && d.cMask.length === 0 && d.color === "0";
  const aBorrar = new Set(mapa.discs.map((d, i) => (sobra(d, i) ? i : -1)).filter((i) => i >= 0));
  if (!aBorrar.size) return;

  const nuevoIndice = [];
  let corrido = 0;
  for (let i = 0; i < mapa.discs.length; i++) {
    nuevoIndice[i] = aBorrar.has(i) ? -1 : i - corrido;
    if (aBorrar.has(i)) corrido++;
  }
  mapa.discs = mapa.discs.filter((_, i) => !aBorrar.has(i));
  if (mapa.joints) {
    mapa.joints = mapa.joints
      .filter((j) => !aBorrar.has(j.d0) && !aBorrar.has(j.d1))
      .map((j) => ({ ...j, d0: nuevoIndice[j.d0], d1: nuevoIndice[j.d1] }));
  }
}

function extraerTemplate(nombreFuncion) {
  const iniFuncion = script.indexOf(`function ${nombreFuncion}`);
  if (iniFuncion === -1) throw new Error(`No encontré ${nombreFuncion} en script.js`);
  const iniTpl = script.indexOf("`{", iniFuncion);
  const finTpl = script.indexOf("`;", iniTpl);
  if (iniTpl === -1 || finTpl === -1) throw new Error(`No pude ubicar el template de ${nombreFuncion}`);
  return script.substring(iniTpl + 1, finTpl);
}

function extraerMapa(modo) {
  let tpl = extraerTemplate(modo.funcion);

  const discosOveja = JSON.stringify(DISCOS_OVEJA).slice(1, -1);
  tpl = tpl.replace(/\$\{JSON\.stringify\(obtenerDiscos\(\)\)\.slice\(1,\s*-1\)\}/g, discosOveja);
  tpl = tpl.replace(/\$\{PelotaFutsal\}/g, PELOTA_COLOR);

  const restantes = tpl.match(/\$\{[^}]+\}/g);
  if (restantes) {
    console.warn(`⚠️  ${modo.funcion}: interpolaciones sin resolver: ${restantes.join(", ")}`);
    tpl = tpl.replace(/\$\{[^}]+\}/g, '""');
  }

  // Los mapas del autor traen comentarios /* 0 */ /* 1 */... que numeran los vértices.
  // JSON.parse no admite comentarios; los sacamos.
  tpl = tpl.replace(/\/\*[\s\S]*?\*\//g, "");

  const mapa = JSON.parse(tpl);

  mapa.name = modo.nombreNuevo;

  pintarPelota(mapa);

  return mapa;
}

const MAX_VERTICES = 255;   // límite duro de HaxBall
const carpeta = __dirname;
const resultados = [];
for (const modo of MAPAS) {
  const mapa = extraerMapa(modo);
  if (mapa.vertexes.length > MAX_VERTICES) {
    console.error(`❌ ${modo.clave}: ${mapa.vertexes.length} vértices, HaxBall admite ${MAX_VERTICES} como máximo.`);
    process.exit(1);
  }
  const json = JSON.stringify(mapa, null, "\t");
  const archivo = path.join(carpeta, `nanduti-futsal-${modo.clave}.hbs`);
  resultados.push({
    archivo,
    info: `${mapa.name}  →  ${mapa.width}x${mapa.height}  (${mapa.vertexes.length}/${MAX_VERTICES} vértices, ${mapa.discs.length} discos)`,
    json,
  });
}

console.log("\n══ Mapas ÑandutíBall (copiados del script) ══\n");
for (const r of resultados) console.log("  🕸️  " + r.info);
console.log("");

if (SOLO_VER) {
  console.log("👀 Modo --ver: no se escribió nada.\n");
  process.exit(0);
}

for (const r of resultados) {
  fs.writeFileSync(r.archivo, r.json);
  console.log(`💾 ${path.basename(r.archivo)}  (${(r.json.length / 1024).toFixed(1)} KB)`);
}
console.log("\n👉 Ahora corré: npm run prueba-mapas\n");
