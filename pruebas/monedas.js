// Prueba el sistema de monedas:
//
//   npm run prueba-monedas
//
// 1. El reparto (sin base): solo cobra el que GANA, con los topes del hat-trick.
// 2. En la sala: se cuentan las atajadas del arquero y el aviso de lo que ganó cada uno
//    le llega SOLO a esa persona.
// 3. Contra la base: se suma el saldo y queda el movimiento en el historial.
//
// Los nicks de prueba llevan una marca con la hora y se borran al final.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const Monedas = require("../models/MonedasModel");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const jugador = (nombre) => ({ nombre, auth: "auth-" + nombre, verificado: true });

(async () => {
  // ── 1) El reparto ──
  console.log("🪙 El reparto:\n");
  const partido = {
    red: [jugador("Ana"), jugador("Beto"), jugador("Caro")],
    blue: [jugador("Dani"), jugador("Eze")],
    ganador: 1,
    goles: { Ana: 5, Dani: 3 },
    asistencias: { Beto: 2, Eze: 4 },
    atajadas: { Caro: 4, Eze: 9 },
  };
  const premios = Monedas.calcular(partido);
  const de = (nombre) => premios.find((p) => p.nombre === nombre);

  revisar("Solo cobran los del equipo ganador", premios.length === 3 && !de("Dani") && !de("Eze"), premios.map((p) => p.nombre).join(", "));
  revisar("Ganar el partido paga 1 moneda a todos los que ganaron",
    premios.every((p) => p.lineas.some((l) => l.motivo === "ganar" && l.monto === 100)));
  revisar("5 goles pagan como mucho 3 (el hat-trick es el tope): 3 + 1 de ganar = 4",
    Monedas.enMonedas(de("Ana").total) === 4, Monedas.enMonedas(de("Ana").total));
  revisar("2 asistencias pagan 2: 2 + 1 = 3", Monedas.enMonedas(de("Beto").total) === 3, Monedas.enMonedas(de("Beto").total));
  revisar("4 atajadas pagan 1,20: 1,20 + 1 = 2,20", Monedas.enMonedas(de("Caro").total) === 2.2, Monedas.enMonedas(de("Caro").total));
  revisar("El que hizo goles pero perdió no cobra nada", !de("Dani"));

  const empate = Monedas.calcular({ ...partido, ganador: 0 });
  revisar("En un empate no cobra nadie", empate.length === 0, empate.length + " premios");

  const sinCuenta = Monedas.calcular(partido, (j) => j.nombre !== "Ana");
  revisar("El que no tiene cuenta en la web no cobra", !sinCuenta.find((p) => p.nombre === "Ana") && sinCuenta.length === 2);

  const muchasAtajadas = Monedas.calcular({ red: [jugador("Tapa")], blue: [jugador("X")], ganador: 1, goles: {}, asistencias: {}, atajadas: { Tapa: 20 } });
  revisar("Las atajadas también tienen tope (3 monedas): 3 + 1 = 4", Monedas.enMonedas(muchasAtajadas[0].total) === 4, Monedas.enMonedas(muchasAtajadas[0].total));

  // ── 2) En la sala ──
  console.log("\n🏟️  En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, anuncios } = sala;

  const ana = entra(1, "Ana");
  avanzar(800);
  const beto = entra(2, "Beto");
  avanzar(3000);

  // La atajada: la pelota va fuerte al arco rojo y la toca el arquero rojo
  room.setPlayerTeam(ana.id, 1);
  room.setPlayerTeam(beto.id, 2);
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  contexto.__sala = room;

  const pelota = { x: -300, y: 0, xspeed: -6, yspeed: 0, radius: 6 };
  room.getDiscProperties = () => pelota;
  const jugadores = room.getPlayerList();
  const jAna = jugadores.find((j) => j.id === ana.id);
  const jBeto = jugadores.find((j) => j.id === beto.id);
  jAna.position = { x: -305, y: 0 };    // Ana es la más atrás del rojo: la arquera
  jBeto.position = { x: 100, y: 0 };
  room.getPlayerDiscProperties = () => ({ radius: 15 });

  if (room.onGameTick) room.onGameTick();
  revisar("Se cuenta la atajada del arquero", (sala.leer("atajadasDelPartido") || {}).Ana === 1, JSON.stringify(sala.leer("atajadasDelPartido")));

  if (room.onGameTick) room.onGameTick();
  revisar("No se cuentan dos atajadas seguidas del mismo arquero", (sala.leer("atajadasDelPartido") || {}).Ana === 1);

  // Si el gol entra igual justo después, esa no era atajada
  if (room.onTeamGoal) room.onTeamGoal(2);
  revisar("Si el gol entra igual, esa atajada no cuenta", (sala.leer("atajadasDelPartido") || {}).Ana === 0, JSON.stringify(sala.leer("atajadasDelPartido")));

  // El aviso de lo que ganó cada uno: privado
  anuncios.length = 0;
  const avisos = [];
  const enviarOriginal = room.sendAnnouncement;
  room.sendAnnouncement = function (texto, destino, color, estilo, sonido) {
    avisos.push({ texto, destino });
    return enviarOriginal.call(room, texto, destino, color, estilo, sonido);
  };
  contexto.__monedasAviso([
    { nombre: "Ana", total: 400, saldo: 1250, lineas: [{ motivo: "ganar", cantidad: 1, monto: 100 }, { motivo: "gol", cantidad: 5, monto: 300 }] },
  ]);
  room.sendAnnouncement = enviarOriginal;

  const suyos = avisos.filter((a) => a.destino === ana.id);
  revisar("El aviso de lo que ganó le llega solo a esa persona", suyos.length === 2 && suyos.every((a) => a.destino === ana.id), suyos.map((a) => a.texto).join(" | "));
  revisar("Dice cuánto ganó y por qué", /Ganaste 4 monedas/.test(suyos[0].texto) && /ganar el partido/.test(suyos[0].texto), suyos[0].texto);
  revisar("Y le dice el saldo que le quedó", /12,5 monedas/.test(suyos[1].texto), suyos[1].texto);
  revisar("A los demás no les llega el detalle de Ana", !avisos.some((a) => a.destino !== ana.id && /Ganaste/.test(a.texto)));
  revisar("Pero sí sale un aviso general para todos", avisos.some((a) => (a.destino === null || a.destino === undefined) && /monedas/i.test(a.texto)));

  // !monedas
  contexto.__MONEDAS = { ana: 1250 };
  avanzar(6000);
  anuncios.length = 0;
  sala.chat(ana, "!monedas");
  revisar("!monedas le dice lo que tiene", anuncios.some((a) => /12,5 monedas/.test(a)), anuncios[0]);
  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 3) Contra la base ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const marca = "Moneda" + Date.now();
  const nicks = [marca + "A", marca + "B"];
  try {
    const delPartido = {
      red: [jugador(nicks[0])],
      blue: [jugador(nicks[1])],
      ganador: 1,
      goles: { [nicks[0]]: 2 },
      asistencias: {},
      atajadas: { [nicks[0]]: 1 },
    };
    const guardados = await Monedas.porPartido(delPartido, { sala: "3v3", partidoId: null });
    revisar("Se guarda el premio del que ganó", guardados.length === 1 && Monedas.enMonedas(guardados[0].total) === 3.3, guardados[0] && Monedas.enMonedas(guardados[0].total));
    revisar("Y devuelve el saldo nuevo", Monedas.enMonedas(guardados[0].saldo) === 3.3, Monedas.enMonedas(guardados[0].saldo));

    await Monedas.porPartido(delPartido, { sala: "3v3" });
    revisar("El saldo se va sumando", Monedas.enMonedas(await Monedas.saldo(nicks[0])) === 6.6, Monedas.enMonedas(await Monedas.saldo(nicks[0])));
    revisar("El que perdió sigue en cero", (await Monedas.saldo(nicks[1])) === 0);

    const historial = await Monedas.historial(nicks[0]);
    revisar("Queda el historial, con el motivo y la sala", historial.length === 2 && historial[0].sala === "3v3" && /2 goles/.test(historial[0].detalle), historial[0] && historial[0].detalle);

    await Monedas.acreditar({ nick: nicks[0], monto: -Monedas.aCentesimas(1.6), motivo: "compra", detalle: "Prueba" });
    const ficha = await Monedas.fichaDe(nicks[0]);
    revisar("Se puede gastar y queda registrado", ficha.monedas === 5 && ficha.gastadas === 1.6 && ficha.historial[0].monto === -1.6, JSON.stringify({ monedas: ficha.monedas, gastadas: ficha.gastadas }));

    let sinSaldo = false;
    try { await Monedas.acreditar({ nick: nicks[0], monto: -Monedas.aCentesimas(999), motivo: "compra" }); } catch { sinSaldo = true; }
    revisar("No se puede quedar en negativo", sinSaldo && (await Monedas.saldo(nicks[0])) === 500);
  } finally {
    await base().movimientoMonedas.deleteMany({ where: { nick: { in: nicks } } });
    await base().monedas.deleteMany({ where: { nick: { in: nicks } } });
  }
  return terminar();
})().catch(async (error) => {
  console.error(error);
  problemas.push(error.message);
  await terminar();
});

async function terminar() {
  await cerrarBase().catch(() => {});
  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Monedas OK: paga solo el que gana, con topes, y queda el historial");
  process.exit(0);
}
