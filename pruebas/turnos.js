// Prueba la selección por turnos: entran 8 espectadores, los capitanes van eligiendo,
// y el que no elige a tiempo se va y le toca al que sigue.
//
//   node pruebas/turnos.js [hosts/3v3.json]
//
// Usa el reloj virtual de sala-falsa.js: hace falta para probar "si no elige en 10
// segundos". Si se corrieran todos los setTimeout de golpe, el primer capitán se ir
// ía antes de poder elegir a mano.

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/3v3.json";
const sala = abrirSala(hostConfig);
const { contexto, avanzar, entra, entran, equipos, chat } = sala;
const cupo = sala.ajustes.maxPlayersPerTeam;

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}
const cancha = () => {
  const e = equipos();
  return e.red.map((j) => j.name).join(", ") + " 🔴 vs 🔵 " + e.blue.map((j) => j.name).join(", ") + "  ·  esperan " + e.espect.length;
};
const capitanDe = (equipo) => equipos()[equipo === 1 ? "red" : "blue"][0];
const libres = () => equipos().espect.filter((j) => j.id !== 0);

console.log("⚙️  " + hostConfig + " — cupo " + cupo + " por equipo, " + contexto.SegundosParaElegir + "s para elegir\n");

// Modo "elegir": el draft manda siempre y el bot no acomoda a nadie por su cuenta
contexto.ModoDeEquipos = "elegir";
contexto.aplicarModoDeEquipos(true);

entran(8);          // espaciados: 5 ingresos en 2 segundos y el script echa al que sobra
avanzar(2000);      // poco rato: a los 10 s sin elegir, al capitán lo echan

console.log("🎽 Entran 8 y salen los dos capitanes:");
revisar("Red y Blue tienen capitán", Boolean(capitanDe(1)) && Boolean(capitanDe(2)), cancha());
revisar("El resto espera", libres().length === 6, libres().length + " esperando");

// ── Los capitanes eligen, sin colgarse ──
console.log("\n🎽 Eligiendo por turnos (a mano, antes de que se acabe el tiempo):");
for (let ronda = 1; ronda <= 8; ronda++) {
  const e = equipos();
  if (e.red.length >= cupo && e.blue.length >= cupo) break;
  if (!libres().length) break;

  // El turno lo decide el script: probamos con los dos capitanes
  let eligio = false;
  for (const equipo of [1, 2]) {
    const cap = capitanDe(equipo);
    const elegido = libres()[0];
    if (!cap || !elegido) continue;
    chat(cap, "!" + elegido.id);
    avanzar(1500);
    if (elegido.team !== 0) {
      console.log(`     ronda ${ronda}: ${cap.name} (${equipo === 1 ? "🔴" : "🔵"}) eligió a ${elegido.name}`);
      eligio = true;
      break;
    }
  }
  if (!eligio) break;
}

const fin = equipos();
revisar("Quedó " + cupo + "v" + cupo, fin.red.length === cupo && fin.blue.length === cupo, cancha());
revisar("Nadie se fue de la sala", sala.expulsados.length === 0, sala.expulsados.length + " expulsados");

// ── El que se cuelga ──
console.log("\n⏳ Un capitán se cuelga y no elige:");
// Vaciamos la cancha para que arranque un draft nuevo
for (const j of [...fin.red, ...fin.blue]) sala.room.setPlayerTeam(j.id, 0);
avanzar(3000);

const colgado = capitanDe(contexto.turnoDelEquipo);
revisar("Hay un capitán con el turno", Boolean(colgado), colgado ? colgado.name + " " + (contexto.turnoDelEquipo === 1 ? "🔴" : "🔵") : "ninguno");

const eran = sala.jugadores.size;
const anunciosAntes = sala.anuncios.length;
avanzar(contexto.SegundosParaElegir * 1000 + 2000);

const cuenta = sala.anuncios.slice(anunciosAntes).filter((a) => /elige en \d…/.test(a));
revisar("Cuenta 3… 2… 1… antes de echarlo", cuenta.length === 3, cuenta.join("  |  ") || "no contó nada");

const echado = sala.expulsados[sala.expulsados.length - 1];
revisar("Al que no eligió se lo echa", Boolean(echado), echado ? echado.nombre + " — " + echado.motivo : "no se echó a nadie");
revisar("Ya no está en la sala", sala.jugadores.size === eran - 1, sala.jugadores.size + " jugadores");
revisar("Sigue habiendo capitán para elegir", Boolean(capitanDe(1)) && Boolean(capitanDe(2)), cancha());
revisar("Y el capitán nuevo no es el que se fue", (capitanDe(1) || {}).id !== (echado || {}).id && (capitanDe(2) || {}).id !== (echado || {}).id);

// ── El modo suave: a espectadores en vez de a la calle ──
console.log("\n👁️ Con EcharAlQueNoElige en false, va a espectadores:");
contexto.EcharAlQueNoElige = false;
const antesDeEchar = sala.expulsados.length;
const capSuave = capitanDe(contexto.turnoDelEquipo);
avanzar(contexto.SegundosParaElegir * 1000 + 2000);

revisar("No se echó a nadie", sala.expulsados.length === antesDeEchar, sala.expulsados.length - antesDeEchar + " expulsados");
revisar("El que no eligió sigue en la sala", Boolean(capSuave && sala.jugadores.get(capSuave.id)), capSuave ? capSuave.name : "—");

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 6).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Turnos OK: se arma " + cupo + "v" + cupo + " eligiendo, y el que no elige a tiempo deja su lugar");
