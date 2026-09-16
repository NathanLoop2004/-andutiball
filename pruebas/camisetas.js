// Prueba que las camisetas paraguayas cambien solas en cada partido.
//
//   node pruebas/camisetas.js [hosts/3v3.json]
//
// El cambio lo hace swapTeamColors() dentro de onGameStart, y solo corre si cambioCami
// está en true. Venía en false (por eso los equipos quedaban siempre iguales), así que
// ahora las salas lo traen prendido en hosts/*.json.

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/3v3.json";
const sala = abrirSala(hostConfig);
const { leer, avanzar, entra, camisetas } = sala;

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const clubes = () => leer("teamRed") + " vs " + leer("teamBlue");

console.log("⚙️  " + hostConfig + "\n");
revisar("La sala trae el cambio de camisetas prendido", sala.ajustes.cambioCami === true && sala.contexto.cambioCami === true, "cambioCami=" + sala.contexto.cambioCami);

entra(1, "Ana");
entra(2, "Beto");
avanzar(9000);

const vistos = [];
revisar("Al arrancar el partido se pone una camiseta", camisetas.length > 0, camisetas.length + " cambios");
vistos.push(clubes());
console.log("     partido 1: " + vistos[0]);

// Unos cuantos partidos: los clubes tienen que ir cambiando
for (let i = 2; i <= 8; i++) {
  sala.room.stopGame();
  avanzar(9000);
  vistos.push(clubes());
  console.log("     partido " + i + ": " + vistos[i - 1]);
}

const distintos = new Set(vistos);
revisar("Los clubes van cambiando de partido a partido", distintos.size > 1, distintos.size + " parejas distintas en " + vistos.length + " partidos");
revisar("Son clubes paraguayos, no Red/Blue", !vistos.some((v) => /RED|BLUE/i.test(v)), vistos[0]);
revisar("Los dos equipos se pintan (Red y Blue)", camisetas.some((c) => c.equipo === 1) && camisetas.some((c) => c.equipo === 2));

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 6).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Camisetas OK: cada partido sale con una pareja de clubes paraguayos");
