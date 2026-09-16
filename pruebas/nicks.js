// Prueba que no te echen por tu propio nombre.
//
//   npm run prueba-nicks
//
// El bug: el script guarda el auth del que usa cada nick y echa al que entre con ese
// nombre y otro auth. El nick solo se liberaba si no quedaba ninguna conexión con esa IP
// — pero la lista de conexiones nunca se limpiaba, así que el nombre quedaba tomado para
// siempre y al volver (desde otro navegador o la compu) te echaba:
//   "🚫 Ese NICKNAME ya está en uso por otro jugador 🚫"

const { abrirSala } = require("./sala-falsa");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const sala = abrirSala("hosts/3v3.json");
const { contexto, leer, avanzar, entra, sale } = sala;

// conn es la IP en hexa, como la manda HaxBall (acá: 127.0.0.1 y 190.0.0.5)
const CASA = "3132372e302e302e31";
const OTRA = "3139302e302e302e35";
const echado = (nombre) => sala.expulsados.some((e) => e.nombre === nombre && /NICKNAME/i.test(e.motivo || ""));

console.log("🚪 El mismo nombre, dos veces:\n");

// 1) Jinder entra desde el celular y se va
entra(1, "Jinder", { conn: CASA, auth: "auth-celular" });
avanzar(2000);
revisar("Entra tranquilo la primera vez", !echado("Jinder"), "adentro");
sale(1);
avanzar(1000);

// 2) Vuelve desde la compu: otro auth, mismo nombre. No tiene que pasar nada.
entra(2, "Jinder", { conn: CASA, auth: "auth-compu" });
avanzar(2000);
revisar("Vuelve desde otro navegador y NO lo echan", !echado("Jinder"), sala.expulsados.map((e) => e.motivo).join(" · ") || "no echaron a nadie");
revisar("El nick quedó libre al irse", leer('usedUsernames["Jinder"]') === "auth-compu", JSON.stringify(leer("usedUsernames")));

// 3) La lista de conexiones no se infla (connections es un let del script, va con leer())
const conexiones = () => leer("connections.length");
revisar("Las conexiones se sueltan al salir", conexiones() === sala.jugadores.size, conexiones() + " conexiones · " + sala.jugadores.size + " en la sala");

// 4) Lo que sí tiene que frenar: alguien usando ese nombre AHORA mismo
console.log("\n🚫 Dos personas con el mismo nombre a la vez:\n");
avanzar(1500);
entra(3, "Jinder", { conn: OTRA, auth: "auth-impostor" });
avanzar(2000);
revisar("Al segundo Jinder sí lo echan", echado("Jinder"), sala.expulsados.map((e) => e.nombre + ": " + e.motivo).pop() || "no lo echaron");
revisar("Y el primero se queda", Boolean(sala.jugadores.get(2)), sala.jugadores.get(2) ? "sigue adentro" : "se fue");

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 5).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Nicks OK: el nombre se libera al salir y solo frena si alguien lo está usando");
