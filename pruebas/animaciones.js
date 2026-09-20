// Prueba las animaciones de gol:
//
//   npm run prueba-animaciones
//
// 1. En la sala: el que tiene una animación puesta festeja con ella, se corta cuando se saca
//    del medio (nadie sigue agrandado adentro del juego) y el que no tiene festeja como antes.
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
  console.log("🎉 En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, anuncios, chat } = sala;

  const ana = entra(1, "Ana");
  avanzar(800);
  const beto = entra(2, "Beto");
  avanzar(3000);

  // Ana tiene una animación de las dos cosas; Beto no tiene ninguna
  contexto.__ANIMACIONES = {
    ana: { clave: "tri", nombre: "Tricampeón", tipo: "ambas", cuadros: ["⚽", "🔥", "👑"],
           tamanos: [1, 2, 1], msPorCuadro: 100, tamanoDesde: 1, tamanoHasta: 1, duracionMs: 1000 },
  };
  contexto.__MIS_ANIMACIONES = { ana: [{ clave: "tri", nombre: "Tricampeón" }] };

  room.setPlayerTeam(ana.id, 1);
  room.setPlayerTeam(beto.id, 2);
  room.startGame();
  avanzar(500);

  // El gol de Ana: el script llama a avatarCelebration, que redeclaramos nosotros
  contexto.avatarCelebration(ana.id, "⚽");
  avanzar(350);

  const suyos = sala.avatares.filter((a) => a.id === ana.id).map((a) => a.avatar);
  revisar("El que tiene animación festeja con sus emojis", suyos.some((a) => a === "🔥" || a === "👑"), suyos.slice(0, 5).join(" "));

  const radios = sala.radios.filter((r) => r.id === ana.id).map((r) => r.radius);
  revisar("Y se hace más grande", radios.some((r) => r > sala.radioNormal), radios.slice(0, 4).map((r) => r.toFixed(1)).join(" "));

  // Cada punto tiene su tamaño: [1, 2, 1] sobre un radio de 15 → 15, 30, 15 y nada en el medio
  const medidas = [...new Set(radios.map((r) => Math.round(r)))].sort((a, b) => a - b);
  revisar("Usa el tamaño de cada punto, no un vaivén", medidas.length === 2 && medidas[0] === 15 && medidas[1] === 30, medidas.join(" y "));

  // Cuando se saca del medio, el festejo se termina: nadie juega agrandado
  if (room.onPositionsReset) room.onPositionsReset();
  avanzar(150);
  const ultimoRadio = sala.radios.filter((r) => r.id === ana.id).pop();
  const ultimoAvatar = sala.avatares.filter((a) => a.id === ana.id).pop();
  revisar("Al sacar del medio vuelve a su tamaño", Boolean(ultimoRadio) && Math.abs(ultimoRadio.radius - sala.radioNormal) < 0.01, ultimoRadio && ultimoRadio.radius);
  revisar("Y se le saca el emoji", Boolean(ultimoAvatar) && ultimoAvatar.avatar === null, JSON.stringify(ultimoAvatar && ultimoAvatar.avatar));

  // Mientras se festeja, el bot NO acomoda a nadie: si no, mete a todos apenas entra el gol
  // y la animación se corta a la mitad.
  contexto.avatarCelebration(ana.id, "⚽");
  revisar("Mientras se festeja, el bot no acomoda a nadie", contexto.festejandoGol() === true);
  avanzar(1100);
  revisar("Cuando termina la animación, el bot vuelve a acomodar", contexto.festejandoGol() === false);

  // La animación es SOLO del que hizo el gol: el de la asistencia festeja como siempre.
  // El script llama a avatarCelebration con el asistidor y un 👟.
  contexto.game = contexto.game || {};
  const antesGoleador = contexto.game.lastKickerId;
  contexto.game.lastKickerId = beto.id;          // el gol lo hizo Beto
  sala.avatares.length = 0;
  contexto.avatarCelebration(ana.id, "👟");      // Ana asistió, y ella sí tiene animación
  avanzar(350);
  const deLaAsistencia = sala.avatares.filter((a) => a.id === ana.id).map((a) => a.avatar);
  revisar("El de la asistencia no usa su animación, aunque tenga una",
    !deLaAsistencia.some((a) => a === "🔥" || a === "👑"), deLaAsistencia.join(" "));
  contexto.game.lastKickerId = antesGoleador;
  if (room.onPositionsReset) room.onPositionsReset();
  avanzar(150);

  // Un gol EN CONTRA no se festeja con la animación: el script llama al mismo
  // avatarCelebration cuando alguien se la mete en su propio arco.
  contexto.game.lastKickerTeam = 1;          // la tocó alguien de rojo…
  sala.avatares.length = 0;
  if (room.onTeamGoal) room.onTeamGoal(2);   // …y el gol fue para azul: gol en contra
  contexto.avatarCelebration(ana.id, "😵");
  avanzar(350);
  const enContra = sala.avatares.filter((a) => a.id === ana.id).map((a) => a.avatar);
  revisar("Un gol en contra no usa la animación", !enContra.some((a) => a === "🔥" || a === "👑"), enContra.join(" "));

  // Y un gol normal sí vuelve a usarla
  contexto.game.lastKickerTeam = 1;
  sala.avatares.length = 0;
  if (room.onTeamGoal) room.onTeamGoal(1);   // gol de rojo para rojo
  contexto.avatarCelebration(ana.id, "⚽");
  avanzar(350);
  const normal = sala.avatares.filter((a) => a.id === ana.id).map((a) => a.avatar);
  revisar("Y el gol normal sí la usa", normal.some((a) => a === "🔥" || a === "👑"), normal.join(" "));
  if (room.onPositionsReset) room.onPositionsReset();
  avanzar(150);

  // La sala tiene que mostrar TODOS los puntos, no solo los primeros
  revisar("En la sala entran los 50 puntos, no 10", sala.leer("MaxCuadrosDeAnimacion") === 50, sala.leer("MaxCuadrosDeAnimacion"));

  // La sala tiene que mostrar TODOS los puntos guardados, aunque la duración no cuadre.
  // Acá se manda una animación de 30 puntos con una duración a propósito equivocada (500 ms,
  // que darían 5 pasos): antes se cortaba, ahora manda la cantidad de puntos.
  const treinta = [];
  for (let i = 0; i < 30; i++) treinta.push(String.fromCharCode(65 + (i % 26)));
  contexto.__ANIMACIONES = {
    ana: { clave: "larga", nombre: "Larga", tipo: "secuencia", cuadros: treinta,
           tamanos: treinta.map(() => 1), msPorCuadro: 100, duracionMs: 500 },
  };
  sala.avatares.length = 0;
  contexto.game.lastKickerTeam = 1;
  if (room.onTeamGoal) room.onTeamGoal(1);
  contexto.avatarCelebration(ana.id, "⚽");
  avanzar(100 * 30 + 300);
  // Se cuentan los cambios de avatar, no los distintos: las letras se repiten después de la Z
  const cambios = sala.avatares.filter((a) => a.id === ana.id && a.avatar).length;
  revisar("Se ven los 30 puntos guardados, no los que diga la duración",
    cambios === 30, cambios + " puntos mostrados");
  if (room.onPositionsReset) room.onPositionsReset();
  avanzar(150);

  // Y se vuelve a dejar la de siempre para lo que sigue
  contexto.__ANIMACIONES = {
    ana: { clave: "tri", nombre: "Tricampeón", tipo: "ambas", cuadros: ["⚽", "🔥", "👑"],
           tamanos: [1, 2, 1], msPorCuadro: 100, tamanoDesde: 1, tamanoHasta: 1, duracionMs: 300 },
  };

  // El que no compró ninguna festeja como siempre (el parpadeo del autor)
  sala.avatares.length = 0;
  contexto.avatarCelebration(beto.id, "⚽");
  avanzar(1200);
  const deBeto = sala.avatares.filter((a) => a.id === beto.id).map((a) => a.avatar);
  revisar("El que no tiene animación festeja como siempre", deBeto.length >= 2 && deBeto.includes("⚽") && deBeto.includes(null), deBeto.join(" "));

  // !animaciones en el chat
  avanzar(6000);
  anuncios.length = 0;
  chat(ana, "!animaciones");
  revisar("!animaciones le muestra las suyas", anuncios.some((a) => /Tricampeón/.test(a)), anuncios[0]);

  avanzar(6000);
  anuncios.length = 0;
  chat(beto, "!animaciones");
  revisar("Al que no tiene le dice dónde se compran", anuncios.some((a) => /Todavía no tenés animaciones/.test(a)), anuncios[0]);

  avanzar(6000);
  contexto.__panelCola = [];
  chat(ana, "!animacion tricampeón");
  revisar("Elegir una avisa a la web para guardarla",
    (contexto.__panelCola || []).some((e) => e.tipo === "animacion" && e.clave === "tri"),
    JSON.stringify((contexto.__panelCola || [])[0]));

  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) Contra la base ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const AnimacionesModel = require("../models/AnimacionesModel");
  const MonedasModel = require("../models/MonedasModel");
  const clave = "anim" + String(Date.now()).slice(-6);
  const nick = "Anim" + Date.now();

  try {
    let mala = null;
    try { await AnimacionesModel.guardar("Con Mayúsculas Y Espacios", { nombre: "x" }, "prueba"); } catch (e) { mala = e.message; }
    revisar("La clave tiene que ser simple", /minúsculas/.test(mala || ""), mala);

    let sinNada = null;
    try { await AnimacionesModel.guardar(clave, { nombre: "Sin nada", cuadros: ["", ""], tamanos: [1, 1] }, "prueba"); } catch (e) { sinNada = e.message; }
    revisar("Puntos que no hacen nada se rechazan", /al menos un punto/.test(sinNada || ""), sinNada);

    const creada = await AnimacionesModel.guardar(clave, {
      nombre: "De prueba",
      tipo: "ambas",
      cuadros: ["⚽", "🔥", "", "⭐", "💥", "🎉", "🚀", "🏆", "😎", "💪", "🐐", "⚡"],   // 12 puntos
      tamanos: [9, 0.01, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1],   // 9 baja a 3 y 0.01 sube a 0.3
      msPorCuadro: 5,        // por debajo del mínimo: sube a 60
      duracionMs: 999999,    // se ignora: la duración sale de la secuencia
    }, "prueba");
    revisar("Los 12 cuadros entran (el tope son 50)", creada.cuadros.length === 12, creada.cuadros.length + " cuadros");
    revisar("La velocidad queda dentro de lo posible", creada.msPorCuadro === 60, creada.msPorCuadro + " ms");
    // El festejo dura LA SECUENCIA: 10 puntos a 60 ms = 600 ms. No se repite ni se corta.
    revisar("La duración sale de la secuencia, no de un número aparte",
      creada.duracionMs === 720, creada.duracionMs + " ms para " + creada.cuadros.length + " puntos de " + creada.msPorCuadro + " ms");
    revisar("Los tamaños de cada punto se recortan a lo posible",
      creada.tamanos.length === 12 && creada.tamanos[0] === 3 && creada.tamanos[1] === 0.3,
      creada.tamanos.slice(0, 3).join(" "));
    revisar("Un punto sin emoji se conserva (es solo de tamaño)", creada.cuadros[2] === "", JSON.stringify(creada.cuadros.slice(0, 4)));
    revisar("El tipo sale solo de lo que se cargó", creada.tipo === "ambas", creada.tipo);

    const conMasPuntos = await AnimacionesModel.guardar(clave, {
      nombre: "De prueba", cuadros: ["⚽", "🔥", "👑", "⭐"], tamanos: [1, 1, 1, 1], msPorCuadro: 400,
    }, "prueba");
    revisar("Agregar puntos alarga el festejo", conMasPuntos.duracionMs === 1600, conMasPuntos.duracionMs + " ms");

    const demasiados = await AnimacionesModel.guardar(clave, {
      nombre: "De prueba", cuadros: new Array(80).fill("⚽"), msPorCuadro: 100,
    }, "prueba");
    revisar("Más de 50 puntos se recortan", demasiados.cuadros.length === 50, demasiados.cuadros.length + " puntos");

    let enTiendaSinPrecio = null;
    try { await AnimacionesModel.guardar(clave, { nombre: "De prueba", cuadros: [""], tamanos: [2], enTienda: true }, "prueba"); } catch (e) { enTiendaSinPrecio = e.message; }
    revisar("No se puede poner en la tienda sin precio", /precio/.test(enTiendaSinPrecio || ""), enTiendaSinPrecio);

    await AnimacionesModel.guardar(clave, { nombre: "De prueba", cuadros: ["⚽", ""], tamanos: [1, 1.8], precio: 2, enTienda: true }, "prueba");
    const vitrina = await AnimacionesModel.vitrina();
    revisar("Con precio sale en la tienda", vitrina.some((a) => a.clave === clave && a.precio === 2));

    await base().usuario.create({ data: { nick, clave: "scrypt$prueba$prueba" } });

    let sinPlata = null;
    try { await AnimacionesModel.comprar(nick, clave); } catch (e) { sinPlata = e.message; }
    revisar("Sin monedas no se compra", /te faltan 2/.test(sinPlata || ""), sinPlata);

    await MonedasModel.acreditar({ nick, monto: MonedasModel.aCentesimas(5), motivo: "prueba" });
    const compra = await AnimacionesModel.comprar(nick, clave);
    revisar("Con monedas se compra y baja el saldo", compra.saldo === 3, "quedaron " + compra.saldo);

    let repetida = null;
    try { await AnimacionesModel.comprar(nick, clave); } catch (e) { repetida = e.message; }
    revisar("No se compra dos veces", /Ya tenés/.test(repetida || ""), repetida);

    await AnimacionesModel.elegir(nick, clave);
    const inventario = await AnimacionesModel.deLaCuenta(nick);
    revisar("Queda en el inventario y puesta", inventario.animaciones.length === 1 && inventario.puesta === clave);

    const paraLaSala = await AnimacionesModel.paraLaSala();
    const suya = paraLaSala[nick.toLowerCase()];
    revisar("La sala la recibe con los emojis Y los tamaños de cada punto",
      Boolean(suya) && Array.isArray(suya.cuadros) && Array.isArray(suya.tamanos) && suya.cuadros.length === suya.tamanos.length,
      JSON.stringify(suya));

    const venta = await AnimacionesModel.vender(nick, clave);
    revisar("Al venderla se devuelve el 70%", venta.devuelto === 1.4, "devolvió " + venta.devuelto);
    const despues = await AnimacionesModel.deLaCuenta(nick);
    revisar("Y se la saca de encima", despues.animaciones.length === 0 && despues.puesta === null);

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

    const publica = await pedir("/api/animaciones");
    revisar("La vitrina la ve cualquiera, sin sesión", publica.status === 200 && publica.datos.animaciones.some((a) => a.clave === clave));

    const catalogoSinSesion = await pedir("/api/animaciones/panel");
    revisar("El catálogo pide sesión", catalogoSinSesion.status === 401, "HTTP " + catalogoSinSesion.status);

    const tokenJugador = SesionModel.firmar({ nick, admin: false });
    const comoJugador = await pedir("/api/animaciones/panel", { headers: { Authorization: "Bearer " + tokenJugador } });
    revisar("Un jugador no entra al catálogo", comoJugador.status === 403, "HTTP " + comoJugador.status);

    const crearComoJugador = await pedir("/api/animaciones/" + clave, json({ __metodo: "PUT", nombre: "robada" }, tokenJugador));
    revisar("Y tampoco puede crear ninguna", crearComoJugador.status === 403, "HTTP " + crearComoJugador.status);

    const RangoModel = require("../models/RangoModel");
    const owner = (await RangoModel.listar()).find((r) => r.admin);
    const tokenOwner = SesionModel.firmar({ nick: (owner.nicks || [])[0] || "JINDER", rango: owner.nombre, admin: true });
    const comoOwner = await pedir("/api/animaciones/panel", { headers: { Authorization: "Bearer " + tokenOwner } });
    revisar("El OWNER sí", comoOwner.status === 200 && Array.isArray(comoOwner.datos.animaciones), "HTTP " + comoOwner.status);

    const guardaOwner = await pedir("/api/animaciones/" + clave, json({ __metodo: "PUT", nombre: "De prueba", cuadros: ["🔥", "⚽"], tamanos: [1.5, 1], msPorCuadro: 500 }, tokenOwner));
    revisar("Y puede guardarla, con la duración salida de la secuencia",
      guardaOwner.status === 200 && guardaOwner.datos.animacion.duracionMs === 1000, guardaOwner.datos.error || guardaOwner.datos.animacion.duracionMs);

    servidor.close();
  } finally {
    await base().animacionComprada.deleteMany({ where: { nick } });
    await base().movimientoMonedas.deleteMany({ where: { nick } });
    await base().monedas.deleteMany({ where: { nick } });
    await base().usuario.deleteMany({ where: { nick } });
    await base().animacion.deleteMany({ where: { clave } });
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
  console.log("✅ Animaciones de gol OK");
}
