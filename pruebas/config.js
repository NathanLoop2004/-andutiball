// Prueba la configuración de las salas desde el panel: parámetros y comandos apagados.
//
//   npm run prueba-config
//
// 1. La sala (sin base): aplica en vivo SOLO lo que cambió, deja los límites para cuando no hay
//    partido, y corta los comandos apagados antes que el script.
// 2. El modelo contra la base: validar, guardar, volver al de fábrica, apagar comandos.
// 3. La API: OWNER, CO-OWNER, HOSTER y AYUDANTE (el AYUDANTE configura y expulsa, pero no banea).
//
// Si la base no está levantada, hace la parte 1 y saltea las otras.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const Parametros = require("../lib/parametros");
const Permisos = require("../lib/permisos");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  // ── 0) Rangos: se compara la palabra, sin emojis ──
  console.log("🎖️  Quién puede configurar:\n");
  revisar("🗦👑🗧 OWNER es OWNER (antes no lo reconocía por los emojis)", Permisos.esOwner({ nombre: "🗦👑🗧 OWNER" }));
  revisar("OWNER, CO-OWNER, HOSTER y AYUDANTE pueden configurar",
    ["🗦👑🗧 OWNER", "🤝 CO-OWNER", "🌐 HOSTER", "🛠️ AYUDANTE"].every((n) => Permisos.puedeConfigurar({ nombre: n })));
  revisar("El AYUDANTE ve las salas, configura y expulsa, pero NO banea",
    Permisos.puedeExpulsar({ nombre: "🛠️ AYUDANTE" }) && Permisos.puedeConfigurar({ nombre: "🛠️ AYUDANTE" }) && !Permisos.puedeBanear({ nombre: "🛠️ AYUDANTE" }));
  revisar("El HOSTER sí puede banear, y el OWNER también",
    Permisos.puedeBanear({ nombre: "🌐 HOSTER" }) && Permisos.puedeBanear({ nombre: "🗦👑🗧 OWNER" }));
  revisar("SUBAYUDANTE, COLABORADOR y ASISTENTE no tocan nada",
    ["🔧 SUBAYUDANTE", "🧉 COLABORADOR", "💡 ASISTENTE"].every((n) => !Permisos.puedeConfigurar({ nombre: n }) && !Permisos.puedeExpulsar({ nombre: n })));

  // ── 1) La sala ──
  console.log("\n🏟️  En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, chat, anuncios, leer } = sala;

  const limites = [];
  room.setTimeLimit = (v) => limites.push(["tiempo", v]);
  room.setScoreLimit = (v) => limites.push(["goles", v]);

  revisar("Todos los parámetros del catálogo existen en el script",
    Parametros.CATALOGO.every((p) => Parametros.valorEnScript(p.nombre) !== undefined || p.nombre === "maxPlayersPerTeam"));

  // Primera vez: solo se anota lo que hay, no se aplica nada
  const base0 = {};
  for (const p of Parametros.CATALOGO) if (p.aplica === "vivo") base0[p.nombre] = Parametros.valorPorDefecto("3v3", p.nombre);
  contexto.__configSala({ parametros: base0, comandosApagados: [] });
  revisar("La primera vez no cambia nada", limites.length === 0 && leer("SegundosParaElegir") === 15, "SegundosParaElegir=" + leer("SegundosParaElegir"));

  // Cambios en vivo, incluida una variable let del script
  contexto.__configSala({ parametros: { ...base0, SegundosParaElegir: 30, modoJueganTodos: true, TiempoDeJuego: 7 }, comandosApagados: [] });
  revisar("Aplica un var de un bloque (SegundosParaElegir)", leer("SegundosParaElegir") === 30, leer("SegundosParaElegir"));
  revisar("Aplica un let del script original (modoJueganTodos)", leer("modoJueganTodos") === true, leer("modoJueganTodos"));
  revisar("Sin partido, los minutos se aplican al toque", leer("TiempoDeJuego") === 7 && limites.some(([q, v]) => q === "tiempo" && v === 7), JSON.stringify(limites));

  // Si alguien lo cambia desde la sala, la base no se lo vuelve a pisar
  vmSet(sala, "modoJueganTodos", false);
  contexto.__configSala({ parametros: { ...base0, SegundosParaElegir: 30, modoJueganTodos: true, TiempoDeJuego: 7 }, comandosApagados: [] });
  revisar("Lo que no cambió en la base no pisa lo que se cambió en la sala", leer("modoJueganTodos") === false);

  // Los interruptores de comando (ConfigSincronizada) van al revés: de la sala a la base
  const cola = () => (contexto.__panelCola || []).filter((e) => e.tipo === "config-sala");
  contexto.__panelCola = [];
  const conPowershot = { ...base0, SegundosParaElegir: 30, modoJueganTodos: true, TiempoDeJuego: 7 };
  vmSet(sala, "powerShotMode", true);   // como si un admin hubiera escrito !powershot
  contexto.__configSala({ parametros: conPowershot, comandosApagados: [] });
  revisar("Lo que se prende con un comando no lo apaga la base", leer("powerShotMode") === true);
  revisar("Y se manda a guardar en la base", cola().length === 1 && cola()[0].nombre === "powerShotMode" && cola()[0].valor === true, JSON.stringify(cola()));
  contexto.__configSala({ parametros: conPowershot, comandosApagados: [] });
  revisar("No se manda dos veces mientras la base no lo devuelve", cola().length === 1 && leer("powerShotMode") === true);
  contexto.__configSala({ parametros: { ...conPowershot, powerShotMode: true }, comandosApagados: [] });
  revisar("Cuando la base ya lo tiene, queda igual", leer("powerShotMode") === true && cola().length === 1);
  contexto.__configSala({ parametros: { ...conPowershot, powerShotMode: false }, comandosApagados: [] });
  revisar("Y después la web lo puede volver a apagar", leer("powerShotMode") === false, leer("powerShotMode"));

  // Con partido en curso, los goles esperan a que termine
  room.startGame();
  if (room.onGameStart) room.onGameStart(null);
  limites.length = 0;
  contexto.__configSala({ parametros: { ...base0, SegundosParaElegir: 30, modoJueganTodos: true, TiempoDeJuego: 7, LimiteDeGoles: 5 }, comandosApagados: [] });
  revisar("Con partido en curso, el límite de goles espera", limites.length === 0 && leer("LimiteDeGoles") === 5, JSON.stringify(limites));
  room.stopGame();
  if (room.onGameStop) room.onGameStop(null);
  revisar("Y se aplica cuando termina el partido", limites.some(([q, v]) => q === "goles" && v === 5), JSON.stringify(limites));

  // Comandos apagados
  const pibe = entra(1, "Pibe1");
  avanzar(3000);
  contexto.__configSala({ parametros: { ...base0, SegundosParaElegir: 30, modoJueganTodos: true, TiempoDeJuego: 7, LimiteDeGoles: 5 }, comandosApagados: ["!elo", "!discord"] });
  anuncios.length = 0;
  const vuelve = chat(pibe, "!elo");
  revisar("Un comando apagado avisa que está desactivado", anuncios.some((a) => /!elo está desactivado/.test(a)), anuncios[0]);
  revisar("Y no llega a ejecutarse", !anuncios.some((a) => /pts|todavía no jugó/.test(a)) && vuelve === false);
  avanzar(6000);
  anuncios.length = 0;
  chat(pibe, "!ELO algo");
  revisar("No importan las mayúsculas ni lo que venga después", anuncios.some((a) => /desactivado/.test(a)));
  avanzar(6000);
  anuncios.length = 0;
  chat(pibe, "!divisiones");
  revisar("Los demás comandos siguen andando", anuncios.some((a) => /DIVISIONES/.test(a)) && !anuncios.some((a) => /desactivado/.test(a)));
  contexto.__configSala({ parametros: base0, comandosApagados: [] });
  avanzar(6000);
  anuncios.length = 0;
  chat(pibe, "!elo");
  revisar("Al prenderlo de nuevo vuelve a funcionar", !anuncios.some((a) => /desactivado/.test(a)) && anuncios.length > 0, anuncios[0]);
  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) El modelo ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }
  const ConfigModel = require("../models/ConfigModel");
  const salaPrueba = "4v4";
  const antesParametros = await base().parametroSala.findMany({ where: { sala: salaPrueba } });
  const antesComandos = await base().comandoApagado.findMany({ where: { sala: { in: [salaPrueba, "*"] } } });

  try {
    await base().parametroSala.deleteMany({ where: { sala: salaPrueba, nombre: { in: ["TiempoDeJuego", "AutoArranque", "NombreHost"] } } });

    const mal = await ConfigModel.guardar(salaPrueba, "TiempoDeJuego", 99, "prueba").catch((e) => e);
    revisar("Valida los límites", mal instanceof Error && /entre 0 y 14/.test(mal.message), mal.message);
    const inventado = await ConfigModel.guardar(salaPrueba, "hackear", true, "prueba").catch((e) => e);
    revisar("No deja tocar variables que no están en el catálogo", inventado instanceof Error, inventado.message);
    const tipo = await ConfigModel.guardar(salaPrueba, "AutoArranque", "si", "prueba").catch((e) => e);
    revisar("Valida el tipo (sí/no)", tipo instanceof Error, tipo.message);

    const g = await ConfigModel.guardar(salaPrueba, "TiempoDeJuego", "6", "prueba");
    const fila = await base().parametroSala.findUnique({ where: { sala_nombre: { sala: salaPrueba, nombre: "TiempoDeJuego" } } });
    revisar("Guarda el cambio (y convierte el número)", g.cambiado && fila && fila.valor === 6 && fila.cambiadoPor === "prueba", JSON.stringify(fila && fila.valor));

    const vista = await ConfigModel.deSala(salaPrueba);
    const tiempo = vista.parametros.find((p) => p.nombre === "TiempoDeJuego");
    revisar("La pantalla muestra el valor nuevo y el de fábrica", tiempo.valor === 6 && tiempo.porDefecto === 4 && tiempo.cambiado, `${tiempo.valor} (fábrica ${tiempo.porDefecto})`);

    const paraSala = await ConfigModel.paraLaSala(salaPrueba);
    revisar("La sala recibe el valor nuevo", paraSala.parametros.TiempoDeJuego === 6);
    revisar("A la sala no le llegan los de reinicio", !("NombreHost" in paraSala.parametros));

    await ConfigModel.guardar(salaPrueba, "TiempoDeJuego", 4, "prueba");
    const borrada = await base().parametroSala.findUnique({ where: { sala_nombre: { sala: salaPrueba, nombre: "TiempoDeJuego" } } });
    revisar("Volver al valor de fábrica borra la fila", borrada === null);

    await ConfigModel.guardar(salaPrueba, "NombreHost", "Sala de prueba", "prueba");
    const { texto, aplicadas } = Parametros.aplicarAlScript("var NombreHost = 'x';\nvar Otro = 1;", await ConfigModel.cambiosDeLaSala(salaPrueba));
    revisar("Al abrir la sala se escribe en el script", aplicadas.includes("NombreHost") && texto.includes('var NombreHost = "Sala de prueba";'), texto.split("\n")[0]);
    await ConfigModel.restablecer(salaPrueba, "NombreHost");

    // Comandos
    const protegido = await ConfigModel.cambiarComando(salaPrueba, "!clave", false, "prueba").catch((e) => e);
    revisar("!clave no se puede apagar", protegido instanceof Error, protegido.message);
    await ConfigModel.cambiarComando(salaPrueba, "!afk", false, "prueba");
    await ConfigModel.cambiarComando("*", "!discord", false, "prueba");
    const conApagados = await ConfigModel.paraLaSala(salaPrueba);
    const otraSala = await ConfigModel.paraLaSala("3v3");
    revisar("Apagar en una sala solo afecta a esa", conApagados.comandosApagados.includes("!afk") && !otraSala.comandosApagados.includes("!afk"));
    revisar("Apagar en todas afecta a todas", conApagados.comandosApagados.includes("!discord") && otraSala.comandosApagados.includes("!discord"));
    const lista = await ConfigModel.comandos(salaPrueba);
    const afk = lista.comandos.find((c) => c.comando === "!afk");
    revisar("La lista de comandos sale del script y marca los apagados", lista.comandos.length > 50 && afk && afk.apagadoAca && afk.apagadoPor === "prueba", lista.comandos.length + " comandos");
    await ConfigModel.cambiarComando(salaPrueba, "!afk", true, "prueba");
    revisar("Y se vuelve a prender", !(await ConfigModel.paraLaSala(salaPrueba)).comandosApagados.includes("!afk"));

    // ── 3) La API, con permisos ──
    console.log("\n🔐 La API:\n");
    const { crearApp } = require("../app");
    const RangoModel = require("../models/RangoModel");
    const claves = require("../lib/claves");
    const SesionModel = require("../models/SesionModel");
    const servidor = await new Promise((listo) => { const s = crearApp({ salas: [] }).listen(0, () => listo(s)); });
    const url = "http://127.0.0.1:" + servidor.address().port;
    const nick = "Config" + Date.now();
    await base().usuario.create({ data: { nick, clave: claves.hashear("clave1234") } });
    const token = SesionModel.firmar({ nick, rango: null, admin: false });
    const pedir = async (ruta, opciones = {}) => {
      const r = await fetch(url + ruta, { ...opciones, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token } });
      return { status: r.status, datos: await r.json().catch(() => ({})) };
    };
    const rangos = await RangoModel.listar();
    const nombreDe = (palabra) => (rangos.find((r) => Permisos.palabraDelRango(r.nombre) === palabra) || {}).nombre;

    try {
      const sinToken = await fetch(url + "/api/config/3v3/parametros");
      revisar("Sin sesión no entra", sinToken.status === 401, "HTTP " + sinToken.status);
      const sinRango = await pedir("/api/config/3v3/parametros");
      revisar("Un jugador sin rango no entra", sinRango.status === 403, sinRango.datos.error);

      if (nombreDe("SUBAYUDANTE")) {
        await RangoModel.asignarNick({ nombreRango: nombreDe("SUBAYUDANTE"), nick });
        const sub = await pedir("/api/config/3v3/parametros");
        revisar("SUBAYUDANTE no entra", sub.status === 403, "HTTP " + sub.status);
      }
      await RangoModel.asignarNick({ nombreRango: nombreDe("HOSTER"), nick });
      const hoster = await pedir("/api/config/3v3/parametros");
      revisar("HOSTER entra y ve los parámetros agrupados", hoster.status === 200 && hoster.datos.parametros.length === Parametros.CATALOGO.length && hoster.datos.grupos.length > 0, "HTTP " + hoster.status);
      const puesto = await pedir("/api/config/4v4/parametros/SegundosParaElegir", { method: "PUT", body: JSON.stringify({ valor: 20 }) });
      revisar("HOSTER puede cambiar un parámetro (queda su nombre)", puesto.status === 200 && (await base().parametroSala.findUnique({ where: { sala_nombre: { sala: "4v4", nombre: "SegundosParaElegir" } } })).cambiadoPor === nick);
      const reset = await pedir("/api/config/4v4/parametros/SegundosParaElegir", { method: "DELETE" });
      revisar("Y volverlo al de fábrica", reset.status === 200 && reset.datos.cambiado === false);
      const cmd = await pedir("/api/config/4v4/comandos", { method: "POST", body: JSON.stringify({ comando: "!mapas", activo: false }) });
      const cmd2 = await pedir("/api/config/4v4/comandos", { method: "POST", body: JSON.stringify({ comando: "!mapas", activo: true }) });
      revisar("Puede apagar y prender comandos", cmd.status === 200 && cmd2.status === 200);
      const noSala = await pedir("/api/config/inventada/parametros");
      revisar("Una sala que no existe da error", noSala.status === 400, noSala.datos.error);

      // Rangos: solo OWNER y CO-OWNER (HOSTER ya tiene el rango puesto acá)
      const rangosHoster = await pedir("/api/rangos");
      revisar("HOSTER no puede ver los rangos", rangosHoster.status === 403, rangosHoster.datos.error);
      const buscarHoster = await pedir("/api/rangos/usuarios?q=");
      revisar("Ni buscar cuentas para darles rango", buscarHoster.status === 403, "HTTP " + buscarHoster.status);
      await RangoModel.asignarNick({ nombreRango: nombreDe("CO-OWNER"), nick });
      const rangosCo = await pedir("/api/rangos");
      revisar("CO-OWNER sí ve los rangos", rangosCo.status === 200 && Array.isArray(rangosCo.datos.roles), "HTTP " + rangosCo.status);
      const sinClaveNick = "SinClave" + Date.now();
      await base().usuario.create({ data: { nick: sinClaveNick } });
      try {
        const cuentas = await pedir("/api/rangos/usuarios?q=" + encodeURIComponent(nick.slice(0, 6)));
        revisar("Busca cuentas que existen para elegirlas", cuentas.status === 200 && cuentas.datos.usuarios.includes(nick), cuentas.datos.usuarios.join(", "));
        const todas = await pedir("/api/rangos/usuarios?q=SinClave");
        revisar("No ofrece nicks sin cuenta de verdad (sin clave)", todas.status === 200 && !todas.datos.usuarios.includes(sinClaveNick));
      } finally {
        await base().usuario.deleteMany({ where: { nick: sinClaveNick } });
      }
    } finally {
      await RangoModel.quitarNick(nick);
      await base().usuario.deleteMany({ where: { nick } });
      servidor.close();
    }
  } finally {
    // Todo queda como estaba antes de la prueba
    await base().parametroSala.deleteMany({ where: { sala: salaPrueba } });
    for (const f of antesParametros) await base().parametroSala.create({ data: { sala: f.sala, nombre: f.nombre, valor: f.valor, cambiadoPor: f.cambiadoPor } });
    await base().comandoApagado.deleteMany({ where: { sala: { in: [salaPrueba, "*"] } } });
    for (const c of antesComandos) await base().comandoApagado.create({ data: { sala: c.sala, comando: c.comando, apagadoPor: c.apagadoPor } });
  }
  return terminar();
})().catch(async (error) => {
  console.error(error);
  problemas.push(error.message);
  await terminar();
});

// Cambia una variable del script como si lo hiciera un comando de la sala
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
  console.log("✅ Configuración de las salas OK: en vivo, en la base y con permisos");
  process.exit(0);
}
