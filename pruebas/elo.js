// Prueba el cálculo de ELO: que el ganador suba, el perdedor baje, que ganarle a uno mejor
// dé más puntos, y que el sistema sea de suma cero.
//
//   npm run prueba-elo

const elo = require("../lib/elo");

const fallos = [];
const revisar = (ok, que) => {
  console.log((ok ? "  ✅ " : "  ❌ ") + que);
  if (!ok) fallos.push(que);
};
const jug = (nombre) => ({ nombre, auth: "auth-" + nombre });

console.log("\n══ Partido parejo (todos empiezan en 1000) ══");
{
  const tabla = {};
  const cambios = elo.aplicarPartido(tabla, {
    red: [jug("Ana"), jug("Beto")],
    blue: [jug("Carlos"), jug("Dani")],
    ganador: 1,
    goles: { Ana: 2 },
  });
  const ana = cambios.find((c) => c.nombre === "Ana");
  const carlos = cambios.find((c) => c.nombre === "Carlos");
  console.log(`  Ana (ganó):    ${ana.antes} → ${ana.despues}  (${ana.delta >= 0 ? "+" : ""}${ana.delta})`);
  console.log(`  Carlos (perdió): ${carlos.antes} → ${carlos.despues}  (${carlos.delta})`);
  revisar(ana.delta > 0, "el que gana sube");
  revisar(carlos.delta < 0, "el que pierde baja");
  revisar(Math.abs(ana.delta + carlos.delta) <= 1, "lo que gana uno lo pierde el otro (suma cero)");
  revisar(tabla["auth:auth-Ana"].ganados === 1 && tabla["auth:auth-Carlos"].perdidos === 1, "se anota ganado/perdido");
  revisar(tabla["auth:auth-Ana"].goles === 2, "se suman los goles del partido");
}

console.log("\n══ Ganarle a uno mejor da más puntos ══");
{
  const tabla = {};
  elo.fichaDe(tabla, jug("Novato")).elo = 900;
  elo.fichaDe(tabla, jug("Crack")).elo = 1400;
  elo.fichaDe(tabla, jug("Novato")).partidos = 50;   // salimos del K de novato para comparar limpio
  elo.fichaDe(tabla, jug("Crack")).partidos = 50;

  const cambios = elo.aplicarPartido(tabla, { red: [jug("Novato")], blue: [jug("Crack")], ganador: 1 });
  const sorpresa = cambios.find((c) => c.nombre === "Novato").delta;

  const tabla2 = {};
  elo.fichaDe(tabla2, jug("Novato")).elo = 900;
  elo.fichaDe(tabla2, jug("Otro")).elo = 900;
  elo.fichaDe(tabla2, jug("Novato")).partidos = 50;
  elo.fichaDe(tabla2, jug("Otro")).partidos = 50;
  const normal = elo.aplicarPartido(tabla2, { red: [jug("Novato")], blue: [jug("Otro")], ganador: 1 }).find((c) => c.nombre === "Novato").delta;

  console.log(`  ganarle a un Crack (1400): +${sorpresa}`);
  console.log(`  ganarle a un igual (900):  +${normal}`);
  revisar(sorpresa > normal, "ganarle a uno mejor suma más");
}

console.log("\n══ Empate ══");
{
  const tabla = {};
  elo.fichaDe(tabla, jug("Fuerte")).elo = 1300;
  elo.fichaDe(tabla, jug("Flojo")).elo = 1000;
  elo.fichaDe(tabla, jug("Fuerte")).partidos = 50;
  elo.fichaDe(tabla, jug("Flojo")).partidos = 50;
  const cambios = elo.aplicarPartido(tabla, { red: [jug("Fuerte")], blue: [jug("Flojo")], ganador: 0 });
  const fuerte = cambios.find((c) => c.nombre === "Fuerte").delta;
  const flojo = cambios.find((c) => c.nombre === "Flojo").delta;
  console.log(`  Fuerte: ${fuerte}   Flojo: +${flojo}`);
  revisar(fuerte < 0 && flojo > 0, "empatar contra uno peor te hace perder puntos");
}

console.log("\n══ Divisiones ══");
for (const puntaje of [800, 950, 1100, 1250, 1400, 1550, 1800]) {
  const d = elo.divisionDe(puntaje);
  const falta = elo.faltaParaSubir(puntaje);
  console.log(`  ${puntaje} → ${d.emoji} ${d.nombre}${falta ? `  (faltan ${falta.puntos} para ${falta.nombre})` : "  (es la más alta)"}`);
}
revisar(elo.divisionDe(800).nombre === "Novato" && elo.divisionDe(1800).nombre === "Leyenda", "las divisiones ordenan bien");

console.log("\n══ Los primeros partidos mueven más ══");
{
  const tabla = {};
  const nuevo = elo.aplicarPartido(tabla, { red: [jug("Nuevo")], blue: [jug("Rival")], ganador: 1 }).find((c) => c.nombre === "Nuevo").delta;
  const tabla2 = {};
  elo.fichaDe(tabla2, jug("Viejo")).partidos = 50;
  elo.fichaDe(tabla2, jug("Rival2")).partidos = 50;
  const veterano = elo.aplicarPartido(tabla2, { red: [jug("Viejo")], blue: [jug("Rival2")], ganador: 1 }).find((c) => c.nombre === "Viejo").delta;
  console.log(`  jugador nuevo: +${nuevo}   |   con 50 partidos: +${veterano}`);
  revisar(nuevo > veterano, "el novato se acomoda más rápido");
}

console.log("\n══ Ranking ══");
{
  const tabla = {};
  for (const [nombre, puntaje] of [["Ana", 1500], ["Beto", 1200], ["Caro", 1750]]) elo.fichaDe(tabla, jug(nombre)).elo = puntaje;
  const r = elo.ranking(tabla);
  console.log("  " + r.map((f, i) => `${i + 1}. ${f.division.emoji} ${f.nombre} ${f.elo}`).join("   "));
  revisar(r[0].nombre === "Caro" && r[2].nombre === "Beto", "el ranking ordena de mayor a menor");
}

console.log("");
if (fallos.length) {
  console.log(`❌ ${fallos.length} fallo(s)`);
  process.exit(1);
}
console.log("✅ El cálculo de ELO funciona\n");
