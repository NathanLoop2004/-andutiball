// Prueba los 3 modos de equipos (!ganasigue / !elegir / !combinado) y la regla nueva:
// si sobra gente, los capitanes eligen y el partido NO arranca hasta que terminen.
//
//   node pruebas/modos.js [hosts/3v3.json]

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/3v3.json";
const sala = abrirSala(hostConfig);
const { contexto, leer, avanzar, entra, entran, sale, equipos, chat, estado } = sala;
const cupo = sala.ajustes.maxPlayersPerTeam;

// Los admins de esta prueba no están en la tabla de rangos, y la ronda de rangos le saca
// el admin a todo el que no figure ahí. Acá se prueba otra cosa, así que se apaga.
contexto.SoloRangosDeLaBase = false;

// Acá se prueban los modos, no el reloj del capitán: con 10 segundos el test se queda sin
// tiempo para elegir y el bot echa al capitán. Le damos aire.
contexto.SegundosParaElegir = 60;


const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}
const cancha = () => {
  const e = equipos();
  return e.red.length + "v" + e.blue.length + " y " + e.espect.length + " esperando";
};

console.log("⚙️  " + hostConfig + " — cupo " + cupo + " por equipo\n");
revisar("Arranca en modo combinado", contexto.ModoDeEquipos === "combinado", contexto.ModoDeEquipos);

// ── 1) Combinado sin gente de sobra: el bot arma y arranca ──
console.log("\n🔀 Combinado con " + cupo * 2 + " jugadores (no sobra nadie):");
entran(cupo * 2);
avanzar(12000);
revisar("No hace falta elegir", contexto.SeleccionPorTurnos === false, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);
revisar("Arrancó solo", sala.jugando(), estado() + ", " + cancha());

// ── 2) Entran 2 más: al terminar el partido se vuelve a elegir ──
console.log("\n🔀 Entran 2 más (ahora sobra gente) y termina el partido:");
entra(90, "Sobra1");
entra(91, "Sobra2");
avanzar(4000);
revisar("En pleno partido no mueve a nadie", contexto.SeleccionPorTurnos === false && sala.jugando(), estado() + ", " + cancha());

sala.disparar("onTeamVictory", { red: 3, blue: 1 });
avanzar(6000);
revisar("Se prendió la elección por turnos", contexto.SeleccionPorTurnos === true, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);
revisar(
  "Se vació la cancha y se avisó que se vuelve a elegir",
  equipos().red.length + equipos().blue.length <= 2 && sala.anuncios.some(function (a) { return a.indexOf("se vuelven a elegir") >= 0; }),
  cancha()
);

avanzar(6000);   // menos que SegundosParaElegir: nadie se va por colgarse
revisar("El partido NO arranca mientras se elige", !sala.enJuego(), estado() + ", " + cancha());

// Y si el partido ya estaba en curso cuando arranca la elección, se pausa
sala.room.startGame();
avanzar(3000);
revisar("Si estaba jugando, se pausa hasta que terminen", sala.pausado(), estado());
revisar("Con un aviso claro", sala.anuncios.some((a) => a.includes("terminen de elegir")), "sí");

// Los capitanes van eligiendo (a mano y a tiempo). El turno lo decide el script,
// así que probamos con los dos capitanes en cada ronda.
const capitanDe = (equipo) => equipos()[equipo === 1 ? "red" : "blue"][0];
const libres = () => equipos().espect.filter((j) => j.id !== 0);

// El número que se escribe es la posición entre los espectadores (sin el bot)
const numero = (j) => equipos().espect.filter((x) => x.id !== 0).findIndex((x) => x.id === j.id) + 1;
const primero = libres()[0];
if (capitanDe(1) && primero) chat(capitanDe(1), "!" + numero(primero));
avanzar(1500);
revisar("El capitán pudo elegir a mano", primero && primero.team !== 0, primero ? primero.name + " → equipo " + primero.team : "no había a quién elegir");

for (let ronda = 0; ronda < 8; ronda++) {
  const e = equipos();
  if ((e.red.length >= cupo && e.blue.length >= cupo) || !libres().length) break;
  const elegido = libres()[0];
  for (const equipo of [1, 2]) {
    const cap = capitanDe(equipo);
    if (!cap) continue;
    chat(cap, "!" + numero(elegido));
    avanzar(1500);
    if (elegido.team !== 0) break;
  }
}

const fin = equipos();
revisar("Se llenaron los equipos eligiendo", fin.red.length === cupo && fin.blue.length === cupo, cancha());
revisar("Nadie se fue por colgarse", sala.expulsados.length === 0, sala.expulsados.length + " expulsados");
avanzar(9000);
revisar("Con los equipos llenos ya arranca", sala.jugando(), estado());

// ── 3) Comando !ganasigue (solo admin) ──
console.log("\n🏆 Un admin escribe !ganasigue:");
const jugador = sala.jugadores.get(1);
const admin = entra(99, "Jefa", { admin: true });
chat(jugador, "!ganasigue");
revisar("A un jugador común no le cambia el modo", contexto.ModoDeEquipos === "combinado", contexto.ModoDeEquipos);
chat(admin, "!ganasigue");
revisar("El admin sí lo cambia", contexto.ModoDeEquipos === "ganasigue", contexto.ModoDeEquipos);
revisar("Se prendió el gana sigue del script", leer("ganasigueEnabled") === true, "ganasigueEnabled=" + leer("ganasigueEnabled"));
revisar("Y se apagó la elección por turnos", contexto.SeleccionPorTurnos === false, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);

// ── 4) Comando !elegir ──
console.log("\n🎽 Un admin escribe !elegir:");
chat(admin, "!elegir");
avanzar(3000);
revisar("Modo elegir", contexto.ModoDeEquipos === "elegir", contexto.ModoDeEquipos);
revisar("Eligen los capitanes siempre", contexto.SeleccionPorTurnos === true, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);
revisar("Se apagó el gana sigue", leer("ganasigueEnabled") === false, "ganasigueEnabled=" + leer("ganasigueEnabled"));

// ── 5) Comando !combinado, y que sin sobrantes vuelva a arrancar solo ──
console.log("\n🔀 Un admin escribe !combinado y se va la gente de sobra:");
chat(admin, "!combinado");
revisar("Modo combinado", contexto.ModoDeEquipos === "combinado", contexto.ModoDeEquipos);
sale(90);
sale(91);
sale(99);
sala.room.stopGame();
avanzar(15000);
revisar("Sin gente de sobra se apaga la elección", contexto.SeleccionPorTurnos === false, "SeleccionPorTurnos=" + contexto.SeleccionPorTurnos);
revisar("Y el partido arranca solo otra vez", sala.jugando(), estado() + ", " + cancha());

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 8).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Modos de equipos OK: combinado, gana sigue y elegir, y con gente de sobra el partido espera");
