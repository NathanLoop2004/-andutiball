// Prueba que en el chat se pueda hablar normal: los comandos SOLO se disparan con "!".
//
//   node pruebas/chat.js [hosts/3v3.json]
//
// Lo que se rompía antes: el script ponía y sacaba del AFK a cualquiera que escribiera
// "estoy", "listo", "volvi", "mtm" o "meteme" en medio de una frase, y el draft tomaba
// cualquier número suelto como una elección.

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/3v3.json";
const sala = abrirSala(hostConfig);
const { contexto, leer, avanzar, entra, entran, equipos, chat, anuncios } = sala;

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const estaAFK = (jugador) => leer(`afkPlayerIDs.has(${jugador.id})`);

// Los admins de esta prueba no están en la tabla de rangos, y la ronda de rangos le saca
// el admin a todo el que no figure ahí. Acá se prueba otra cosa, así que se apaga.
contexto.SoloRangosDeLaBase = false;

const seDijo = (texto) => anuncios.some((a) => a.includes(texto));
const equipoDe = (id) => (sala.jugadores.get(id) || {}).team;

console.log("⚙️  " + hostConfig + "\n");

const ana = entra(1, "Ana");
entran(7, "Pibe", 2);
const jefa = entra(9, "Jefa", { admin: true });
// Acá se prueba el chat, no el reloj del draft: sin tiempo límite nadie sale por colgarse
contexto.SegundosParaElegir = 9999;
avanzar(6000);

console.log("💬 Hablar normal no dispara nada:");
for (const frase of ["estoy re picante hoy", "listo el pollo", "ya volvi de comer", "mtm no me sale nada"]) {
  const antes = estaAFK(ana);
  chat(ana, frase);
  revisar(`"${frase}" no toca el AFK`, estaAFK(ana) === antes && !estaAFK(ana), "AFK=" + estaAFK(ana));
  revisar(`   y se ve en el chat`, seDijo(frase), seDijo(frase) ? "sí" : "no salió");
}

console.log("\n🤫 Los comandos no se ven en el chat:");
const antesDeComando = anuncios.length;
chat(ana, "!clave miContraseñaSecreta");
revisar("Lo que escribís con ! no sale en el chat", !anuncios.slice(antesDeComando).some((a) => a.includes("miContraseñaSecreta")), "no se filtró la clave");
chat(ana, "!help");
revisar("Ni el comando en sí", !anuncios.slice(antesDeComando).some((a) => /:\s+!help/.test(a)), "sin eco");
avanzar(6000);   // el cooldown de comandos del script

console.log("\n😴 El AFK sigue andando con el comando:");
chat(ana, "!afk");
avanzar(10000);   // el script hace esperar entre comando y comando (commandCooldown)
revisar("!afk pone AFK", estaAFK(ana) === true, "AFK=" + estaAFK(ana));
chat(ana, "!afk");
avanzar(10000);
revisar("!afk otra vez lo saca", estaAFK(ana) === false, "AFK=" + estaAFK(ana));

console.log("\n🎽 Con el draft prendido, un número suelto es un número:");
// Draft de verdad: modo elegir, sin partido y con la cancha vacía
contexto.ModoDeEquipos = "elegir";
contexto.aplicarModoDeEquipos(true);
sala.room.stopGame();
for (const j of equipos().red.concat(equipos().blue)) sala.room.setPlayerTeam(j.id, 0);
avanzar(4000);
revisar("Hay elección por turnos", contexto.SeleccionPorTurnos === true, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);

const libre = equipos().espect.filter((j) => j.id !== 0 && j.id !== 9)[0];
revisar("Hay alguien esperando para ser elegido", Boolean(libre), libre ? libre.name + " (id " + libre.id + ")" : "nadie");

if (libre) {
  chat(jefa, String(libre.id));
  avanzar(1000);
  revisar(`"${libre.id}" NO lo mete a la cancha`, equipoDe(libre.id) === 0, "equipo " + equipoDe(libre.id));
  revisar("   y el número se ve en el chat", seDijo(`:    ${libre.id}`) || seDijo(` ${libre.id}`), "sí");

  chat(jefa, "!" + libre.id);
  avanzar(1000);
  revisar(`"!${libre.id}" sí lo elige`, equipoDe(libre.id) !== 0, "equipo " + equipoDe(libre.id));

  const otro = equipos().espect.filter((j) => j.id !== 0 && j.id !== 9)[0];
  if (otro) {
    chat(jefa, "!elegir " + otro.id);
    avanzar(1000);
    revisar(`"!elegir ${otro.id}" también`, equipoDe(otro.id) !== 0, "equipo " + equipoDe(otro.id));
  }
}

console.log("\n💬 Una charla cualquiera pasa entera:");
for (const frase of ["hola a todos", "buenisimo el gol", "3 - 1 vamos", "t equipo arriba"]) {
  chat(ana, frase);
  revisar(`"${frase}"`, seDijo(frase.startsWith("t ") ? frase.slice(2) : frase), "sí");
}

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 6).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Chat OK: se puede hablar de todo y los comandos solo salen con !");
