// Camisetas de los clubes paraguayos: reemplaza la lista de clubes del script,
// los cruces del cambio automático y las reglas de camisetas parecidas.
// Formato de HaxBall:  /colors <equipo> <ángulo> <color del número> <franja1> <franja2> <franja3>

const KITS = {
  // ── PRIMERA DIVISIÓN ──
  oli: { nombre: "OLIMPIA", com: "CLUB OLIMPIA (Decano)", angle: 90, text: "000000", colors: ["FFFFFF", "000000", "FFFFFF"] },
  cer: { nombre: "CERRO PORTEÑO", com: "CERRO PORTEÑO (Azulgrana)", angle: 0, text: "FFFFFF", colors: ["002D72", "D71920", "002D72"] },
  lib: { nombre: "LIBERTAD", com: "CLUB LIBERTAD (Gumarelo)", angle: 0, text: "FFD100", colors: ["000000", "FFFFFF", "000000"] },
  gua: { nombre: "GUARANÍ", com: "CLUB GUARANÍ (Aborigen)", angle: 0, text: "000000", colors: ["000000", "FFD100", "000000"] },
  nac: { nombre: "NACIONAL", com: "CLUB NACIONAL (Academia)", angle: 0, text: "009B48", colors: ["FFFFFF", "009B48", "FFFFFF"] },
  luq: { nombre: "SP. LUQUEÑO", com: "SPORTIVO LUQUEÑO (Auriazul)", angle: 0, text: "0033A0", colors: ["0033A0", "FFD100", "0033A0"] },
  rec: { nombre: "RECOLETA", com: "RECOLETA FC (El Canario)", angle: 0, text: "000000", colors: ["FFE500", "FFE500", "FFE500"] },
  rno: { nombre: "RUBIO ÑU", com: "CLUB RUBIO ÑU (Albiverde)", angle: 0, text: "FFFFFF", colors: ["009B48", "FFFFFF", "009B48"] },
  tri: { nombre: "SP. TRINIDENSE", com: "SPORTIVO TRINIDENSE (Franja amarilla)", angle: 90, text: "FCD116", colors: ["0A2472", "FCD116", "0A2472"] },
  ame: { nombre: "AMELIANO", com: "SPORTIVO AMELIANO (V azul)", angle: 90, text: "1D4E9E", colors: ["FFFFFF", "1D4E9E", "FFFFFF"] },
  san: { nombre: "SP. SAN LORENZO", com: "SPORTIVO SAN LORENZO (Rayadita)", angle: 0, text: "000000", colors: ["D71920", "FFFFFF", "D71920"] },
  dma: { nombre: "2 DE MAYO", com: "SPORTIVO 2 DE MAYO (Albiazul)", angle: 0, text: "FFD100", colors: ["003DA5", "FFFFFF", "003DA5"] },
  // ── DIVISIÓN INTERMEDIA ──
  doj: { nombre: "12 DE JUNIO", com: "CLUB 12 DE JUNIO (León del Chaco)", angle: 90, text: "FCD000", colors: ["0A3A82", "FCD000", "0A3A82"] },
  tno: { nombre: "3 DE NOVIEMBRE", com: "CLUB 3 DE NOVIEMBRE (Trico)", angle: 0, text: "FFFFFF", colors: ["D52B1E", "FFFFFF", "002E7A"] },
  tem: { nombre: "TEMBETARY", com: "ATLÉTICO TEMBETARY (Rojiverde)", angle: 0, text: "FFFFFF", colors: ["D71920", "009B48", "D71920"] },
  ace: { nombre: "BENJAMÍN ACEVAL", com: "CLUB BENJAMÍN ACEVAL (Blanquirrojo)", angle: 0, text: "D71920", colors: ["FFFFFF", "D71920", "FFFFFF"] },
  cap: { nombre: "DEP. CAPIATÁ", com: "DEPORTIVO CAPIATÁ (Bastonero)", angle: 0, text: "FFFFFF", colors: ["003DA5", "F9D616", "003DA5"] },
  sni: { nombre: "DEP. SANTANÍ", com: "DEPORTIVO SANTANÍ (Blanco y negro)", angle: 90, text: "FFFFFF", colors: ["000000", "FFFFFF", "000000"] },
  enc: { nombre: "ENCARNACIÓN", com: "ENCARNACIÓN FC (Albirrojo)", angle: 90, text: "FFFFFF", colors: ["D71920", "FFFFFF", "D71920"] },
  fdm: { nombre: "FDO. DE LA MORA", com: "CLUB FERNANDO DE LA MORA (Piel roja)", angle: 0, text: "FFFFFF", colors: ["E1000F", "E1000F", "FFFFFF"] },
  gca: { nombre: "GRAL. CABALLERO JLM", com: "GENERAL CABALLERO JLM (El Rojo)", angle: 0, text: "FFFFFF", colors: ["E1000F", "E1000F", "E1000F"] },
  gui: { nombre: "GUAIREÑA", com: "GUAIREÑA FC (Albiceleste)", angle: 0, text: "003DA5", colors: ["FFFFFF", "6CA9DD", "FFFFFF"] },
  inc: { nombre: "INDEPENDIENTE CG", com: "INDEPENDIENTE FBC de Campo Grande", angle: 0, text: "003DA5", colors: ["FFFFFF", "003DA5", "FFFFFF"] },
  pgi: { nombre: "PARAGUARÍ", com: "PARAGUARÍ AC (Rojo)", angle: 0, text: "FFFFFF", colors: ["C8102E", "C8102E", "C8102E"] },
  res: { nombre: "RESISTENCIA", com: "RESISTENCIA SC (Triángulo Rojo)", angle: 0, text: "FFFFFF", colors: ["5AB1E5", "5AB1E5", "5AB1E5"] },
  sol: { nombre: "SOL DE AMÉRICA", com: "CLUB SOL DE AMÉRICA (Danzarín)", angle: 0, text: "FFFFFF", colors: ["1B3D8F", "1B3D8F", "1B3D8F"] },
  car: { nombre: "SP. CARAPEGUÁ", com: "SPORTIVO CARAPEGUÁ (Potro)", angle: 90, text: "D71920", colors: ["FFFFFF", "D71920", "FFFFFF"] },
  tac: { nombre: "TACUARY", com: "CLUB TACUARY (Franja negra)", angle: 0, text: "000000", colors: ["FFFFFF", "000000", "FFFFFF"] },
  // ── SELECCIÓN ──
  par: { nombre: "PARAGUAY", com: "SELECCIÓN PARAGUAYA (Albirroja)", angle: 0, text: "002E7A", colors: ["D52B1E", "FFFFFF", "D52B1E"] },
};

// Cruces del cambio automático, sin repetir colores parecidos
const CRUCES = [
  ["oli", "cer", 1800], ["cer", "oli", 1600], ["lib", "cer", 900], ["oli", "gua", 800],
  ["cer", "luq", 700], ["gua", "rec", 650], ["luq", "oli", 600], ["nac", "cer", 600],
  ["oli", "sol", 550], ["cer", "rno", 500], ["lib", "gui", 500], ["san", "cer", 450],
  ["tri", "oli", 450], ["luq", "lib", 420], ["par", "cer", 500], ["par", "sol", 400],
  ["rec", "cer", 400], ["tem", "gui", 380], ["dma", "gua", 380], ["cap", "lib", 360],
  ["ame", "cer", 360], ["gui", "gca", 340], ["car", "sol", 320], ["enc", "gua", 320],
  ["tac", "cer", 300], ["res", "gua", 300], ["nac", "tem", 300], ["oli", "res", 300],
];

// Pares que se confunden en la cancha: el azul cambia de camiseta
const PARECIDOS = [
  ["oli", "nac"], ["oli", "tac"], ["oli", "ame"], ["oli", "gui"], ["oli", "inc"], ["oli", "car"],
  ["lib", "gua"], ["lib", "sni"], ["gua", "luq"], ["san", "enc"], ["san", "ace"], ["car", "ace"],
  ["fdm", "gca"], ["gca", "pgi"], ["sol", "cer"], ["tri", "dma"],
];

const hx = (c) => "0x" + c;

function ladoDelPartido(lado, kit) {
  const n = lado === "red" ? 1 : 2;
  const nombreVar = lado === "red" ? "Red" : "Blue";
  return `${lado}Angle=${kit.angle};${lado}TextColor=${hx(kit.text)};${lado}Color=[${kit.colors.map(hx).join(",")}];room.setTeamColors(${n},${lado}Angle,${lado}TextColor,${lado}Color);team${nombreVar}="${kit.nombre}"`;
}

function aplicar(script) {
  // 1. Lista de camisetas (cada club en versión red y blue)
  const ini = script.indexOf("var camisetasEquipos = {");
  const fin = script.indexOf("\n};", ini) + 3;
  if (ini < 0 || fin < 3) throw new Error("no se encontró camisetasEquipos");
  let lista = "var camisetasEquipos = {\n";
  for (const [clave, kit] of Object.entries(KITS)) {
    lista += `    // ${kit.com}\n`;
    for (const equipo of ["red", "blue"]) {
      lista += `    "${clave}/titular/${equipo}": {\n        codigo: "/colors ${equipo} ${kit.angle} ${kit.text} ${kit.colors.join(" ")}",\n        nombreEquipo: "${kit.nombre}"\n    },\n`;
    }
  }
  script = script.slice(0, ini) + lista + "};" + script.slice(fin);

  // 2. Camisetas por defecto: Olimpia y Cerro
  script = script
    .replace(/var camisetaRed = "[^"]*";/, 'var camisetaRed = "/colors red 90 000000 FFFFFF 000000 FFFFFF"; // OLIMPIA')
    .replace(/var NombreEquipoRojo = "[^"]*";/, 'var NombreEquipoRojo = "OLIMPIA";')
    .replace(/var camisetaBlue = "[^"]*";/, 'var camisetaBlue = "/colors blue 0 FFFFFF 002D72 D71920 002D72"; // CERRO PORTEÑO')
    .replace(/var NombreEquipoAzul = "[^"]*";/, 'var NombreEquipoAzul = "CERRO PORTEÑO";');

  // 3. Cruces del cambio automático de camisetas
  const opIni = script.indexOf("var opciones=[");
  const opFin = script.indexOf(",];function toggleSwapColors", opIni) + 2;
  if (opIni >= 0 && opFin > 2) {
    const opciones =
      "var opciones=[" +
      CRUCES.map(([r, b, d]) => `{partido:function(){${ladoDelPartido("red", KITS[r])};${ladoDelPartido("blue", KITS[b])}},demanda:${d}}`).join(",") +
      ",]";
    script = script.slice(0, opIni) + opciones + script.slice(opFin);
  }

  // 4. Reglas de camisetas parecidas (modo gana sigue)
  const regla = (a, b) =>
    `if((camisetaRedActual==="${a}/titular/red"&&camisetaBlueActual==="${b}/titular/blue")||(camisetaRedActual==="${b}/titular/red"&&camisetaBlueActual==="${a}/titular/blue")){camisetaBlueActual=elegirNuevaCamiseta(camisetaBlueActual,"blue",camisetaRedActual)}`;
  const primeraRegla = script.search(/if\(\(camisetaRedActual==="[a-z]{3}\/titular\/red"/);
  if (primeraRegla !== -1) {
    const marcaFin = 'camisetaBlueActual=elegirNuevaCamiseta(camisetaBlueActual,"blue",camisetaRedActual)}';
    let ultima = primeraRegla;
    let pos = primeraRegla;
    while (true) {
      const sig = script.indexOf(marcaFin, pos);
      if (sig === -1) break;
      const finRegla = sig + marcaFin.length;
      const resto = script.slice(finRegla, finRegla + 60);
      ultima = finRegla;
      if (!/^\s*if\(\(camisetaRedActual/.test(resto)) break;
      pos = finRegla;
    }
    script = script.slice(0, primeraRegla) + PARECIDOS.map(([a, b]) => regla(a, b)).join("\n") + script.slice(ultima);
  }

  return script;
}

module.exports = { aplicar, KITS, CRUCES, PARECIDOS };
