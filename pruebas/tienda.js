// Prueba la tienda de camisetas y el inventario de cada cuenta:
//
//   npm run prueba-tienda
//
// 1. En la sala: !camisetas muestra las que compró, !camiseta se la pone, y al arrancar el
//    partido el equipo juega con esa camiseta.
// 2. Contra la base: comprar descuenta las monedas, queda en el inventario, no se compra dos
//    veces ni sin saldo, y el historial de monedas lo registra.
// 3. La API: la vitrina es pública, comprar pide sesión y los precios son solo de OWNER/CO-OWNER.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  // ── 1) En la sala ──
  console.log("👕 En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, anuncios, chat, leer } = sala;

  const ana = entra(1, "Ana");
  avanzar(800);
  const beto = entra(2, "Beto");
  avanzar(3000);

  contexto.__MIS_CAMISETAS = { ana: [{ clave: "oli", nombre: "OLIMPIA" }, { clave: "cer", nombre: "CERRO PORTEÑO" }] };
  contexto.__CAMISETA_PUESTA = {};

  anuncios.length = 0;
  chat(ana, "!camisetas");
  revisar("!camisetas le muestra las suyas", anuncios.some((a) => /OLIMPIA/.test(a) && /CERRO/.test(a)), anuncios[0]);

  avanzar(6000);
  anuncios.length = 0;
  chat(beto, "!camisetas");
  revisar("Al que no tiene ninguna le dice dónde se compran", anuncios.some((a) => /Todavía no tenés camisetas/.test(a)), anuncios[0]);

  avanzar(6000);
  contexto.__panelCola = [];
  anuncios.length = 0;
  chat(ana, "!camiseta olimpia");
  const cola = (contexto.__panelCola || []).filter((e) => e.tipo === "camiseta");
  revisar("Elegir una avisa a la web para guardarla", cola.length === 1 && cola[0].clave === "oli" && cola[0].nick === "Ana", JSON.stringify(cola[0]));
  revisar("Y se lo confirma a la persona", anuncios.some((a) => /Te pusiste la de OLIMPIA/.test(a)), anuncios[0]);

  avanzar(6000);
  anuncios.length = 0;
  chat(ana, "!camiseta boca");
  revisar("Una que no es suya se rechaza", anuncios.some((a) => /no es tuya/.test(a)), anuncios[0]);

  avanzar(6000);
  contexto.__panelCola = [];
  chat(ana, "!camiseta ninguna");
  revisar("Se la puede sacar", (contexto.__panelCola || []).some((e) => e.tipo === "camiseta" && e.clave === null));

  // De espectador no se cambia la camiseta: primero hay que estar en la cancha
  avanzar(6000);
  contexto.__panelCola = [];
  anuncios.length = 0;
  room.setPlayerTeam(ana.id, 0);
  chat(ana, "!camiseta olimpia");
  revisar("De espectador no se puede cambiar la camiseta",
    anuncios.some((a) => /Primero tenés que estar jugando/.test(a)) && !(contexto.__panelCola || []).some((e) => e.tipo === "camiseta"), anuncios[0]);

  // La camiseta la pone el CAPITÁN, y solo cuando los equipos se arman eligiendo.
  //
  // Ojo con el color que se usa para reconocerla: antes acá iba el negro de verdad de Olimpia
  // (000000) y la prueba fallaba sola cada tanto, porque Olimpia y Tacuary son kits del sorteo
  // y el sorteo los puede sacar por su cuenta (Olimpia es el más pesado). Se usa un magenta
  // que no tiene ningún kit: si aparece, es sí o sí la del capitán.
  const MAGENTA = 0xff00ff;
  contexto.__CAMISETA_PUESTA = { ana: { clave: "oli", nombre: "OLIMPIA", angulo: 90, texto: "000000", colores: ["FFFFFF", "FF00FF", "FFFFFF"] } };
  vmSet(sala, "SeleccionPorTurnos", false);   // como cuando el bot acomoda solo
  room.setPlayerTeam(ana.id, 1);
  sala.camisetas.length = 0;
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  avanzar(800);
  revisar("Sin elección de capitanes, sale la camiseta del sorteo", !sala.camisetas.some((c) => c.equipo === 1 && c.colores[1] === MAGENTA), sala.camisetas.length + " camisetas");

  vmSet(sala, "SeleccionPorTurnos", true);   // como en los modos elegir y combinado
  sala.camisetas.length = 0;
  anuncios.length = 0;
  room.stopGame();
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  avanzar(800);
  const delRojo = sala.camisetas.filter((c) => c.equipo === 1).pop();
  revisar("Eligiendo, el equipo juega con la camiseta del capitán", Boolean(delRojo) && delRojo.colores[1] === MAGENTA, JSON.stringify(delRojo));
  revisar("Y se avisa de quién es", anuncios.some((a) => /camiseta de OLIMPIA/.test(a) && /Ana/.test(a)), anuncios.find((a) => /camiseta de/.test(a)));

  // El que no es capitán no le cambia la camiseta al equipo
  room.setPlayerTeam(beto.id, 1);   // Ana es la capitana (entró primero)
  avanzar(6000);
  contexto.__MIS_CAMISETAS = { ana: [{ clave: "oli", nombre: "OLIMPIA" }], beto: [{ clave: "cer", nombre: "CERRO PORTEÑO" }] };
  contexto.__panelCola = [];
  anuncios.length = 0;
  // El modo combinado apaga la elección cuando no sobra gente, así que se vuelve a prender acá.
  // Y los dos tienen que estar en el MISMO equipo: si Beto queda solo en el suyo, es capitán él.
  vmSet(sala, "SeleccionPorTurnos", true);
  room.setPlayerTeam(ana.id, 1);
  room.setPlayerTeam(beto.id, 1);
  chat(beto, "!camiseta cerro porteño");
  revisar("Solo el capitán cambia la camiseta del equipo",
    anuncios.some((a) => /la elige el capitán/.test(a)) && !(contexto.__panelCola || []).some((e) => e.tipo === "camiseta"), anuncios[0]);
  // La camiseta elegida DURA los partidos siguientes, aunque la elección de capitanes se apague.
  // En el modo "combinado" eso pasa solo entre partidos cuando no sobra gente: antes se perdía
  // la camiseta y salía la del sorteo, justo lo que el comando promete que no va a pasar.
  avanzar(6000);
  contexto.__MIS_CAMISETAS = { ana: [{ clave: "oli", nombre: "OLIMPIA" }] };
  contexto.__CAMISETA_PUESTA = {};
  vmSet(sala, "SeleccionPorTurnos", true);
  room.setPlayerTeam(ana.id, 1);
  room.setPlayerTeam(beto.id, 2);
  chat(ana, "!camiseta olimpia");   // la elige siendo capitana
  contexto.__CAMISETA_PUESTA = { ana: { clave: "oli", nombre: "OLIMPIA", angulo: 90, texto: "000000", colores: ["FFFFFF", "FF00FF", "FFFFFF"] } };

  vmSet(sala, "SeleccionPorTurnos", false);   // el combinado apaga la elección entre partidos
  sala.camisetas.length = 0;
  room.stopGame();
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  avanzar(800);
  const siguiente = sala.camisetas.filter((c) => c.equipo === 1).pop();
  revisar("La camiseta elegida dura en el partido siguiente, aunque se apague la elección",
    Boolean(siguiente) && siguiente.colores[1] === MAGENTA, JSON.stringify(siguiente));

  // Si el que la eligió SE VA DE LA SALA, su camiseta deja de mandar y vuelve la del sorteo.
  // Ojo: no alcanza con mandarlo a espectadores, porque el acomodo automático lo devuelve a la
  // cancha en cuanto arranca el partido y la camiseta sigue siendo suya, con razón.
  sala.sale(ana.id);
  sala.camisetas.length = 0;
  room.stopGame();
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  avanzar(800);
  revisar("Si el que la eligió se va, vuelve la del sorteo",
    !sala.camisetas.some((c) => c.equipo === 1 && c.colores[1] === MAGENTA), sala.camisetas.length + " camisetas");

  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) Contra la base ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }
  const TiendaModel = require("../models/TiendaModel");
  const MonedasModel = require("../models/MonedasModel");
  const EquiposModel = require("../models/EquiposModel");

  const marca = "t" + String(Date.now()).slice(-6);
  const clave = marca;
  const nick = "Compra" + Date.now();

  try {
    await EquiposModel.crearEquipo({ clave, nombre: "Camiseta de prueba", color1: "112233", color2: "445566", color3: "778899" }, "prueba");

    const antesDeVender = await TiendaModel.vitrina();
    revisar("Sin precio no sale en la tienda", !antesDeVender.some((c) => c.clave === clave));

    let sinPrecio = null;
    try { await TiendaModel.ponerPrecio(clave, { enTienda: true }, "prueba"); } catch (e) { sinPrecio = e.message; }
    revisar("No se puede poner en la tienda sin precio", /precio/.test(sinPrecio || ""), sinPrecio);

    await TiendaModel.ponerPrecio(clave, { precio: 2.5, enTienda: true, detalle: "Una camiseta de prueba" }, "prueba");
    const vitrina = await TiendaModel.vitrina();
    const enVenta = vitrina.find((c) => c.clave === clave);
    revisar("Con precio sale en la vitrina, con su descripción", Boolean(enVenta) && enVenta.precio === 2.5 && /prueba/.test(enVenta.detalle), enVenta && enVenta.precio);

    await base().usuario.create({ data: { nick, clave: "scrypt$prueba$prueba" } });

    let sinPlata = null;
    try { await TiendaModel.comprar(nick, clave); } catch (e) { sinPlata = e.message; }
    revisar("Sin monedas no se puede comprar, y dice cuánto falta", /te faltan 2,5|te faltan 2.5/.test(sinPlata || ""), sinPlata);

    await MonedasModel.acreditar({ nick, monto: MonedasModel.aCentesimas(4), motivo: "prueba" });
    const compra = await TiendaModel.comprar(nick, clave);
    revisar("Con monedas se compra y baja el saldo", compra.saldo === 1.5, "quedaron " + compra.saldo);

    const movimiento = (await MonedasModel.historial(nick))[0];
    revisar("Queda en el historial de monedas como compra", movimiento.motivo === "compra" && movimiento.monto === -2.5, movimiento.detalle);

    const inventario = await TiendaModel.deLaCuenta(nick);
    revisar("Y queda en el inventario de esa cuenta", inventario.camisetas.length === 1 && inventario.camisetas[0].clave === clave && inventario.camisetas[0].pagada === 2.5);

    let repetida = null;
    try { await TiendaModel.comprar(nick, clave); } catch (e) { repetida = e.message; }
    revisar("No se compra dos veces la misma", /Ya tenés esa camiseta/.test(repetida || ""), repetida);

    let ajena = null;
    try { await TiendaModel.elegir(nick, "cer"); } catch (e) { ajena = e.message; }
    revisar("No se puede poner una que no compró", /no es tuya/.test(ajena || ""), ajena);

    await TiendaModel.elegir(nick, clave);
    const conPuesta = await TiendaModel.deLaCuenta(nick);
    revisar("Se puede elegir una de las suyas", conPuesta.puesta === clave, conPuesta.puesta);

    const paraLaSala = await TiendaModel.paraLaSala();
    revisar("La sala recibe la camiseta puesta con sus colores",
      paraLaSala[nick.toLowerCase()] && paraLaSala[nick.toLowerCase()].colores[0] === "112233", JSON.stringify(paraLaSala[nick.toLowerCase()]));

    await TiendaModel.elegir(nick, null);
    revisar("Y se la puede sacar", (await TiendaModel.deLaCuenta(nick)).puesta === null);

    // ── Vender: se devuelve el 70% de lo que pagó ──
    await TiendaModel.elegir(nick, clave);   // puesta, para ver que también se la saca
    const saldoPrevio = await MonedasModel.saldo(nick);
    const venta = await TiendaModel.vender(nick, clave);
    revisar("Al vender te devuelven el 70% de lo que pagaste", venta.devuelto === 1.75 && venta.pagaste === 2.5, `pagó ${venta.pagaste}, le dieron ${venta.devuelto}`);
    revisar("Y esas monedas vuelven al saldo", MonedasModel.aCentesimas(venta.saldo) === saldoPrevio + 175, venta.saldo);

    const despuesDeVender = await TiendaModel.deLaCuenta(nick);
    revisar("La camiseta sale del inventario", !despuesDeVender.camisetas.some((c) => c.clave === clave));
    revisar("Y si la tenía puesta, se la saca", despuesDeVender.puesta === null);

    const movimientoVenta = (await MonedasModel.historial(nick))[0];
    revisar("La venta queda en el historial", movimientoVenta.motivo === "venta" && movimientoVenta.monto === 1.75, movimientoVenta.detalle);

    let yaVendida = null;
    try { await TiendaModel.vender(nick, clave); } catch (e) { yaVendida = e.message; }
    revisar("No se vende dos veces la misma", /no está en tu inventario/.test(yaVendida || ""), yaVendida);

    // Y se puede volver a comprar
    await MonedasModel.acreditar({ nick, monto: MonedasModel.aCentesimas(1), motivo: "prueba" });
    const recompra = await TiendaModel.comprar(nick, clave);
    revisar("Después de venderla se puede volver a comprar", Boolean(recompra.camiseta), recompra.saldo);

    // El precio no tiene tope: lo pone el OWNER
    const carisima = await TiendaModel.ponerPrecio(clave, { precio: 25000 }, "prueba");
    revisar("No hay precio máximo: lo decide el OWNER", carisima.precio === 25000, carisima.precio);
    await TiendaModel.ponerPrecio(clave, { precio: 2.5 }, "prueba");

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

    const publica = await pedir("/api/tienda");
    revisar("La vitrina la ve cualquiera, sin sesión", publica.status === 200 && publica.datos.camisetas.some((c) => c.clave === clave));

    const sinSesion = await pedir("/api/tienda/comprar", json({ clave }));
    revisar("Comprar pide sesión", sinSesion.status === 401, "HTTP " + sinSesion.status);

    const tokenJugador = SesionModel.firmar({ nick, admin: false });
    const precioJugador = await pedir("/api/tienda/" + clave, json({ __metodo: "PUT", precio: 0, enTienda: false }, tokenJugador));
    revisar("Un jugador no puede tocar los precios", precioJugador.status === 403, "HTTP " + precioJugador.status);

    const RangoModel = require("../models/RangoModel");
    const owner = (await RangoModel.listar()).find((r) => r.admin);
    const tokenOwner = SesionModel.firmar({ nick: (owner.nicks || [])[0] || "JINDER", rango: owner.nombre, admin: true });
    const precioOwner = await pedir("/api/tienda/" + clave, json({ __metodo: "PUT", precio: 3, enTienda: true }, tokenOwner));
    revisar("El OWNER sí", precioOwner.status === 200 && precioOwner.datos.camiseta.precio === 3, precioOwner.datos.error);

    servidor.close();
  } finally {
    await base().camisetaComprada.deleteMany({ where: { nick } });
    await base().movimientoMonedas.deleteMany({ where: { nick } });
    await base().monedas.deleteMany({ where: { nick } });
    await base().usuario.deleteMany({ where: { nick } });
    await base().equipo.deleteMany({ where: { clave } });
  }
  return terminar();
})().catch(async (error) => {
  console.error(error);
  problemas.push(error.message);
  await terminar();
});

// Cambia una variable del script, como lo haría un comando de la sala
function vmSet(sala, nombre, valor) {
  sala.leer(`${nombre} = ${JSON.stringify(valor)}`);
}

async function terminar() {
  await cerrarBase().catch(() => {});
  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Tienda OK: se compra con monedas, queda en el inventario y se usa en la sala");
  process.exit(0);
}
