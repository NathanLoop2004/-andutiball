// Prueba el arranque automático: que el partido vuelva solo después de un Stop y que
// una pausa se levante sola, siempre que haya 2 jugadores despiertos (sin AFK).
//
//   node pruebas/autoarranque.js [hosts/todos.json]
//
// La sala falsa corre con reloj virtual (pruebas/sala-falsa.js): sin eso no se puede
// probar "a los 5 segundos arranca" ni "a los 10 se levanta la pausa".

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/todos.json";
const sala = abrirSala(hostConfig);
const { room, contexto, avanzar, entra, sale, afk, estado } = sala;

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

console.log("⚙️  " + hostConfig + "\n");

// Entran dos jugadores
const ana = entra(1, "Ana");
const beto = entra(2, "Beto");
avanzar(8000);
revisar("Con 2 jugadores el partido arranca solo", sala.jugando(), estado());

// 1) El admin le da a Stop
console.log("\n🛑 Un admin le da a Stop:");
room.stopGame();
avanzar(3000);
revisar("A los 3 s sigue parado (respiro por si cambian el mapa)", !sala.enJuego(), estado());
avanzar(6000);
revisar("A los 9 s volvió a arrancar", sala.jugando(), estado());

// 2) El partido queda en pausa
console.log("\n⏸️  Alguien deja el partido en pausa:");
room.pauseGame(true);
avanzar(5000);
revisar("A los 5 s sigue pausado", sala.pausado(), estado());
avanzar(9000);
revisar("A los 14 s se reanudó solo", sala.jugando(), estado());

// El modo automatizado reacomoda el mapa (stop + start) cada vez que cambia la cantidad de
// jugadores despiertos. Para probar el AFK lo apagamos: si no, nos reinicia el partido solo.
contexto.automatizadoActivado = false;

// 3) Pausa con uno de los dos AFK
console.log("\n💤 Pausa con uno de los dos AFK:");
afk(beto);
revisar("Beto quedó AFK", contexto.disponiblesParaJugar().length === 1, contexto.disponiblesParaJugar().length + " despiertos");
room.pauseGame(true);
avanzar(20000);
revisar("No se reanuda mientras Beto esté AFK", sala.pausado(), estado());
afk(beto);
avanzar(15000);
revisar("Vuelve Beto y se reanuda", sala.jugando(), estado());

// 4) Stop con uno de los dos AFK
console.log("\n💤 Stop con uno de los dos AFK:");
afk(beto);
room.stopGame();
avanzar(20000);
revisar("No arranca mientras Beto esté AFK", !sala.enJuego(), estado());
afk(beto);
avanzar(15000);
revisar("Vuelve Beto y arranca", sala.jugando(), estado());

// 5) El partido termina: el script no lo cierra solo, lo cerramos nosotros
console.log("\n🏁 Termina el partido (hay ganador):");
const partidosAntes = sala.arranques();
sala.disparar("onTeamVictory", { red: 3, blue: 1 });
avanzar(4000);
revisar("Enseguida no lo tocamos (fotos, figura del partido)", sala.enJuego(), estado());
avanzar(22000);
revisar("Se cerró y ya arrancó el siguiente", sala.jugando() && sala.arranques() > partidosAntes, estado() + ", " + (sala.arranques() - partidosAntes) + " partido nuevo");

// 6) Se va uno: sin gente no se juega
console.log("\n👋 Se queda uno solo:");
sale(2);
room.stopGame();
avanzar(15000);
revisar("Con un solo jugador no arranca", !sala.enJuego(), estado());

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 8).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Arranque automático OK: vuelve del Stop, levanta la pausa, cierra el partido terminado y respeta a los AFK");
