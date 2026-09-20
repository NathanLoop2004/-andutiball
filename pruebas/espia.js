// Prueba el espía del panel (lib/espia.js): cada cosa que pasa en la sala tiene que
// registrarse UNA sola vez, aunque el handler se reasigne muchas veces.
//
//   node pruebas/espia.js
//
// El bug que atrapa: el panel mostraba cada mensaje del chat 3 veces, porque el espía
// envolvía CADA asignación de room.onPlayerChat (la del script, la de la selección por
// turnos y la de los modos de equipos) y cada capa registraba el mismo mensaje.

const { crearSalaEspiada } = require("../lib/espia");
const { abrirSala } = require("./sala-falsa");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// ── 1) Las capas, a mano ──
console.log("🔍 Tres bloques encadenando el mismo handler:\n");

const eventos = [];
const salaCruda = {};
const sala = crearSalaEspiada(salaCruda, (e) => eventos.push(e));

const pasos = [];
// Así lo asigna el script del autor
sala.onPlayerChat = (jugador, mensaje) => { pasos.push("script"); return true; };
// Así lo encadenan nuestros bloques (turnos y modos)
const anterior1 = sala.onPlayerChat;
sala.onPlayerChat = (jugador, mensaje) => { pasos.push("turnos"); return anterior1(jugador, mensaje); };
const anterior2 = sala.onPlayerChat;
sala.onPlayerChat = (jugador, mensaje) => { pasos.push("modos"); return anterior2(jugador, mensaje); };

// HaxBall llama al handler que quedó puesto en la sala de verdad
const respuesta = salaCruda.onPlayerChat({ name: "SantiGRJ" }, "33");

revisar("El mensaje se registra una sola vez", eventos.filter((e) => e.tipo === "chat").length === 1, eventos.filter((e) => e.tipo === "chat").length + " veces");
revisar("Corrieron los tres handlers, en orden", pasos.join(" → ") === "modos → turnos → script", pasos.join(" → "));
revisar("Se registró el nombre y el texto", eventos[0].jugador === "SantiGRJ" && eventos[0].texto === "33", JSON.stringify(eventos[0]));
revisar("Vuelve lo que devuelve el handler del script", respuesta === true, String(respuesta));

// Un handler que devuelve false (un comando) también tiene que llegar entero
sala.onPlayerChat = () => false;
revisar("El false de un comando no se pierde", salaCruda.onPlayerChat({ name: "x" }, "!afk") === false);

// Los eventos que no se espían quedan intactos
const tick = () => "tick";
sala.onGameTick = tick;
revisar("onGameTick no se toca", salaCruda.onGameTick === tick);

// ── 2) Con el script de verdad y todos nuestros bloques ──
console.log("\n🏟️  Con script.js entero y los bloques de ÑandutíHax:\n");

const salaFalsa = abrirSala("hosts/3v3.json", { espiar: true });
const ana = salaFalsa.entra(1, "Ana");
salaFalsa.entra(2, "Beto");
salaFalsa.avanzar(6000);

const cuantos = (tipo) => salaFalsa.eventosPanel.filter((e) => e.tipo === tipo).length;

const chatsAntes = cuantos("chat");
salaFalsa.chat(ana, "hola a todos");
revisar("Un mensaje = un evento de chat", cuantos("chat") - chatsAntes === 1, cuantos("chat") - chatsAntes + " eventos");

const entraAntes = cuantos("entra");
salaFalsa.entra(3, "Caro");
revisar("Un jugador que entra = un evento", cuantos("entra") - entraAntes === 1, cuantos("entra") - entraAntes + " eventos");

const saleAntes = cuantos("sale");
salaFalsa.sale(3);
revisar("Un jugador que sale = un evento", cuantos("sale") - saleAntes === 1, cuantos("sale") - saleAntes + " eventos");

const partidoAntes = cuantos("partido");
salaFalsa.room.stopGame();
revisar("Un stop = un evento de partido", cuantos("partido") - partidoAntes === 1, cuantos("partido") - partidoAntes + " eventos");

salaFalsa.avanzar(9000);
revisar("Y el arranque siguiente, otro solo", cuantos("partido") - partidoAntes === 2, cuantos("partido") - partidoAntes + " eventos");

console.log("");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Espía OK: un evento por cosa que pasa, sin importar cuántos bloques encadenen el handler");
