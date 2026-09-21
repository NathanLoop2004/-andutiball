// Prueba los carteles de gol:
//
//   npm run prueba-scores
//
// 1. En la sala: el que tiene cartel comprado cambia el aviso del marcador por el suyo, el
//    que no tiene ve el de siempre, y un gol en contra tampoco lo usa.
// 2. Contra la base: crear, validar, ponerle precio, comprar, vender y elegir.
// 3. La API: la vitrina es pública y el catálogo es SOLO de OWNER y CO-OWNER.
//
// Usa claves y nicks con la hora adentro, y borra todo lo que crea.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  // ── 1) En la sala ──
  console.log("🥅 En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, anuncios, chat } = sala;

  const ana = entra(1, "Ana");
  avanzar(800);
  const beto = entra(2, "Beto");
  avanzar(3000);

  contexto.__SCORES = {
    ana: {
      clave: "golazo", nombre: "Golazo",
      plantilla: "🚀 LA CLAVÓ {jugador} · {equipo} {golesPropios} 🆚 {golesRival} {rival}",
      color: "FF00FF", estilo: "bold", sonido: 2,
    },
  };
  contexto.__MIS_SCORES = { ana: [{ clave: "golazo", nombre: "Golazo" }] };

  room.setPlayerTeam(ana.id, 1);
  room.setPlayerTeam(beto.id, 2);
  room.startGame();
  avanzar(500);

  // Gol de Ana (rojo). El script arma su aviso con 🆚 y el bloque lo cambia por el suyo.
  contexto.game = contexto.game || {};
  contexto.game.lastKickerId = ana.id;
  contexto.game.lastKickerName = "Ana";
  contexto.game.lastKickerTeam = 1;
  anuncios.length = 0;
  if (room.onTeamGoal) room.onTeamGoal(1);
  avanzar(300);

  const conCartel = anuncios.filter((a) => a.includes("LA CLAVÓ"));
  revisar("El que tiene cartel ve el suyo", conCartel.length === 1, conCartel[0]);
  revisar("Y se le reemplazan los huecos", Boolean(conCartel[0]) && conCartel[0].includes("Ana") && !conCartel[0].includes("{"), conCartel[0]);
  revisar("El aviso de siempre no sale además del suyo",
    anuncios.filter((a) => a.includes("🆚")).length === 1,
    anuncios.filter((a) => a.includes("🆚")).length + " avisos con marcador");

  // Un gol de Beto, que no tiene cartel: el de siempre
  contexto.game.lastKickerId = beto.id;
  contexto.game.lastKickerName = "Beto";
  contexto.game.lastKickerTeam = 2;
  anuncios.length = 0;
  if (room.onTeamGoal) room.onTeamGoal(2);
  avanzar(300);
  revisar("El que no tiene cartel ve el de siempre", !anuncios.some((a) => a.includes("LA CLAVÓ")));

  // Gol en contra de Ana: tampoco usa su cartel
  contexto.game.lastKickerId = ana.id;
  contexto.game.lastKickerName = "Ana";
  contexto.game.lastKickerTeam = 1;
  anuncios.length = 0;
  if (room.onTeamGoal) room.onTeamGoal(2);   // la tocó rojo y el gol fue para azul
  avanzar(300);
  revisar("Un gol en contra no usa el cartel", !anuncios.some((a) => a.includes("LA CLAVÓ")));

  // Los comandos
  avanzar(6000);
  anuncios.length = 0;
  chat(ana, "!carteles");
  revisar("!carteles le muestra los suyos", anuncios.some((a) => /Golazo/.test(a)), anuncios[0]);

  avanzar(6000);
  anuncios.length = 0;
  chat(beto, "!carteles");
  revisar("Al que no tiene le dice dónde se compran", anuncios.some((a) => /Todavía no tenés carteles/.test(a)), anuncios[0]);

  avanzar(6000);
  contexto.__panelCola = [];
  chat(ana, "!cartel golazo");
  revisar("Elegir uno avisa a la web para guardarlo",
    (contexto.__panelCola || []).some((e) => e.tipo === "score" && e.clave === "golazo"),
    JSON.stringify((contexto.__panelCola || [])[0]));

  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) Contra la base ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const ScoresModel = require("../models/ScoresModel");
  const MonedasModel = require("../models/MonedasModel");
  const clave = "sc" + String(Date.now()).slice(-6);
  const nick = "Score" + Date.now();

  try {
    let sinTexto = null;
    try { await ScoresModel.guardar(clave, { nombre: "Vacío" }, "prueba"); } catch (e) { sinTexto = e.message; }
    revisar("Sin texto no se puede guardar", /cómo se ve el cartel/.test(sinTexto || ""), sinTexto);

    let colorMalo = null;
    try { await ScoresModel.guardar(clave, { nombre: "x", plantilla: "GOL", color: "rojo" }, "prueba"); } catch (e) { colorMalo = e.message; }
    revisar("El color tiene que ser en números y letras", /color va en 6/.test(colorMalo || ""), colorMalo);

    let muyLargo = null;
    try { await ScoresModel.guardar(clave, { nombre: "x", plantilla: "G".repeat(300) }, "prueba"); } catch (e) { muyLargo = e.message; }
    revisar("Y no puede ser larguísimo", /no puede pasar de/.test(muyLargo || ""), muyLargo);

    const creado = await ScoresModel.guardar(clave, {
      nombre: "De prueba",
      plantilla: "⚽ GOL DE {jugador} · {equipo} {golesPropios} 🆚 {golesRival} {rival} · {minuto}",
      color: "#ff00ff", estilo: "inventado", sonido: 9, precio: 4, enTienda: true,
    }, "prueba");
    revisar("El color se guarda en mayúsculas y sin #", creado.color === "FF00FF", creado.color);
    revisar("Un estilo inventado cae en el de siempre", creado.estilo === "bold", creado.estilo);
    revisar("Un sonido inventado también", creado.sonido === 2, creado.sonido);
    revisar("Trae el ejemplo ya armado, sin huecos",
      creado.ejemplo.includes("JINDER") && !creado.ejemplo.includes("{"), creado.ejemplo);

    // La misma cuenta que hace la sala
    const armado = ScoresModel.armar("GOL DE {jugador} ({asistencia})", { jugador: "ANA", asistencia: "" });
    revisar("Un hueco vacío no deja texto raro", armado === "GOL DE ANA ()", JSON.stringify(armado));

    await base().usuario.create({ data: { nick, clave: "scrypt$prueba$prueba" } });
    let sinPlata = null;
    try { await ScoresModel.comprar(nick, clave); } catch (e) { sinPlata = e.message; }
    revisar("Sin monedas no se compra", /te faltan 4/.test(sinPlata || ""), sinPlata);

    await MonedasModel.acreditar({ nick, monto: MonedasModel.aCentesimas(10), motivo: "prueba" });
    const compra = await ScoresModel.comprar(nick, clave);
    revisar("Con monedas se compra y baja el saldo", compra.saldo === 6, "quedaron " + compra.saldo);

    await ScoresModel.elegir(nick, clave);
    const inventario = await ScoresModel.deLaCuenta(nick);
    revisar("Queda en el inventario y puesto", inventario.scores.length === 1 && inventario.puesto === clave);

    const paraLaSala = await ScoresModel.paraLaSala();
    const suyo = paraLaSala[nick.toLowerCase()];
    revisar("La sala lo recibe con la plantilla y el color",
      Boolean(suyo) && suyo.plantilla.includes("{jugador}") && suyo.color === "FF00FF", JSON.stringify(suyo));

    // Se vende por lo que vale hoy, igual que las otras tiendas
    await ScoresModel.guardar(clave, { nombre: "De prueba", plantilla: "GOL", precio: 10, enTienda: true }, "prueba");
    const venta = await ScoresModel.vender(nick, clave);
    revisar("Se vende por el precio de HOY", venta.devuelto === 7, "devolvió " + venta.devuelto);
    revisar("Y se lo saca de encima", (await ScoresModel.deLaCuenta(nick)).puesto === null);

    // ── 3) La API ──
    console.log("\n🔐 La API:\n");
    const { crearApp } = require("../app");
    const SesionModel = require("../models/SesionModel");
    const servidor = await new Promise((listo) => {
      const s = require("http").createServer(crearApp({ salas: [] }));
      s.listen(0, () => listo(s));
    });
    const url = "http://127.0.0.1:" + servidor.address().port;
    const pedir = async (ruta, opciones) => {
      const r = await fetch(url + ruta, opciones);
      let datos = null;
      try { datos = await r.json(); } catch {}
      return { status: r.status, datos };
    };
    const json = (cuerpo, token) => ({
      method: cuerpo.__metodo || "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
      body: JSON.stringify(cuerpo),
    });

    const publica = await pedir("/api/scores");
    revisar("La vitrina la ve cualquiera, sin sesión", publica.status === 200 && publica.datos.scores.some((s) => s.clave === clave));

    const catalogoSinSesion = await pedir("/api/scores/panel");
    revisar("El catálogo pide sesión", catalogoSinSesion.status === 401, "HTTP " + catalogoSinSesion.status);

    const tokenJugador = SesionModel.firmar({ nick, admin: false });
    const comoJugador = await pedir("/api/scores/panel", { headers: { Authorization: "Bearer " + tokenJugador } });
    revisar("Un jugador no entra al catálogo", comoJugador.status === 403, "HTTP " + comoJugador.status);

    const crearComoJugador = await pedir("/api/scores/" + clave, json({ __metodo: "PUT", nombre: "robado", plantilla: "GOL" }, tokenJugador));
    revisar("Y tampoco puede crear ninguno", crearComoJugador.status === 403, "HTTP " + crearComoJugador.status);

    const RangoModel = require("../models/RangoModel");
    const owner = (await RangoModel.listar()).find((r) => r.admin);
    const tokenOwner = SesionModel.firmar({ nick: (owner.nicks || [])[0] || "JINDER", rango: owner.nombre, admin: true });
    const comoOwner = await pedir("/api/scores/panel", { headers: { Authorization: "Bearer " + tokenOwner } });
    revisar("El OWNER sí", comoOwner.status === 200 && Array.isArray(comoOwner.datos.scores), "HTTP " + comoOwner.status);

    servidor.close();
  } finally {
    await base().scoreComprado.deleteMany({ where: { nick } });
    await base().movimientoMonedas.deleteMany({ where: { nick } });
    await base().monedas.deleteMany({ where: { nick } });
    await base().usuario.deleteMany({ where: { nick } });
    await base().score.deleteMany({ where: { clave } });
    await base().precioHistorial.deleteMany({ where: { clave } });
  }

  return terminar();
})().catch((error) => {
  console.error("\n💥 " + error.stack);
  process.exit(1);
});

async function terminar() {
  await cerrarBase().catch(() => {});
  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Carteles de gol OK");
}
