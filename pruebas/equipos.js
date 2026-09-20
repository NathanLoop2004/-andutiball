// Prueba las camisetas de los clubes y los clásicos:
//
//   npm run prueba-equipos
//
// 1. En la sala: las camisetas que manda la base rearman camisetasEquipos y las opciones del
//    cambio automático, y el partido sale con esos colores.
// 2. El modelo contra la base: validar colores, crear, cambiar y borrar, y los clásicos.
// 3. La API con permisos: sin sesión no se ve nada; un jugador tampoco.
//
// Lo que crea lo borra al final: los equipos de prueba llevan una marca con la hora.

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
  const { contexto, room, avanzar, entra, leer } = sala;

  const datos = {
    equipos: [
      { clave: "aaa", nombre: "EQUIPO A", angulo: 90, texto: "000000", colores: ["FFFFFF", "FF0000", "FFFFFF"] },
      { clave: "bbb", nombre: "EQUIPO B", angulo: 0, texto: "FFFFFF", colores: ["0000FF", "00FF00", "0000FF"] },
    ],
    clasicos: [{ red: "aaa", blue: "bbb", demanda: 900 }],
  };
  contexto.__equiposSala(datos);

  const lista = leer("camisetasEquipos") || {};
  revisar("Se rearma la lista de camisetas", Object.keys(lista).length === 4 && Boolean(lista["aaa/titular/red"]), Object.keys(lista).join(", "));
  revisar("Cada camiseta lleva el código /colors que entiende HaxBall",
    lista["aaa/titular/red"].codigo === "/colors red 90 000000 FFFFFF FF0000 FFFFFF", lista["aaa/titular/red"].codigo);

  const opciones = leer("opciones") || [];
  revisar("Los clásicos quedan como opciones del cambio automático", opciones.length === 1 && opciones[0].demanda === 900, opciones.length + " opciones");

  sala.camisetas.length = 0;
  opciones[0].partido();
  revisar("Al jugarse el clásico, se le pone la camiseta a cada equipo", sala.camisetas.length === 2, JSON.stringify(sala.camisetas.map((c) => c.equipo)));
  revisar("El rojo sale con los colores del primero",
    sala.camisetas[0].equipo === 1 && sala.camisetas[0].colores[1] === 0xFF0000, JSON.stringify(sala.camisetas[0]));
  revisar("Y los nombres de los equipos quedan puestos", leer("teamRed") === "EQUIPO A" && leer("teamBlue") === "EQUIPO B", leer("teamRed") + " vs " + leer("teamBlue"));

  // Mandar lo mismo otra vez no rearma nada (la firma no cambió)
  contexto.__equiposSala(datos);
  revisar("Si no cambió nada, no se rearma al pedo", (leer("opciones") || []).length === 1);

  // !equipos
  const pibe = entra(1, "Pibe1");
  avanzar(3000);
  sala.anuncios.length = 0;
  sala.chat(pibe, "!equipos");
  revisar("!equipos dice cuántas camisetas hay cargadas", sala.anuncios.some((a) => /2 camisetas y 1 clásicos/.test(a)), sala.anuncios[0]);
  revisar("La sala no tiró errores", sala.errores.length === 0, sala.errores.slice(0, 2).join(" | "));

  // ── 2) El modelo ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }
  const EquiposModel = require("../models/EquiposModel");
  const marca = "z" + String(Date.now()).slice(-6);
  const claves = [marca + "a", marca + "b"];

  try {
    const { equipos } = await EquiposModel.listar();
    revisar("Los clubes de siempre están en la base", equipos.some((e) => e.clave === "oli") && equipos.some((e) => e.clave === "cer"), equipos.length + " equipos");

    const nuevo = await EquiposModel.crearEquipo({ clave: claves[0], nombre: "prueba fc", color1: "#ff0000", color2: "00FF00", color3: "0000FF", colorTexto: "FFFFFF", angulo: 45 }, "prueba");
    revisar("Se crea un equipo y el nombre queda en mayúsculas", nuevo.nombre === "PRUEBA FC" && nuevo.color1 === "FF0000", nuevo.nombre + " " + nuevo.color1);

    let mal = null;
    try { await EquiposModel.crearEquipo({ clave: claves[1], nombre: "Mal", color1: "xyz", color2: "000000", color3: "000000" }, "prueba"); } catch (e) { mal = e.message; }
    revisar("Un color mal escrito se rechaza", /color de 6 dígitos/.test(mal || ""), mal);

    let repetido = null;
    try { await EquiposModel.crearEquipo({ clave: claves[0], nombre: "Otro", color1: "000000", color2: "000000", color3: "000000" }, "prueba"); } catch (e) { repetido = e.message; }
    revisar("No se repiten las claves", /Ya hay un equipo/.test(repetido || ""), repetido);

    await EquiposModel.crearEquipo({ clave: claves[1], nombre: "Rival FC", color1: "111111", color2: "222222", color3: "333333" }, "prueba");
    const clasico = await EquiposModel.guardarClasico({ red: claves[0], blue: claves[1], demanda: 1234 }, "prueba");
    revisar("Se guarda un clásico con su demanda", clasico.demanda === 1234 && clasico.red === claves[0]);

    let mismo = null;
    try { await EquiposModel.guardarClasico({ red: claves[0], blue: claves[0], demanda: 100 }, "prueba"); } catch (e) { mismo = e.message; }
    revisar("Un clásico no puede ser contra sí mismo", /dos equipos distintos/.test(mismo || ""), mismo);

    let enUso = null;
    try { await EquiposModel.borrarEquipo(claves[0]); } catch (e) { enUso = e.message; }
    revisar("No se borra un equipo que está en un clásico", /está en un clásico/.test(enUso || ""), enUso);

    const paraLaSala = await EquiposModel.paraLaSala();
    revisar("Lo que recibe la sala trae los colores en un solo campo",
      paraLaSala.equipos.some((e) => e.clave === claves[0] && e.colores.join("") === "FF000000FF000000FF"));
    revisar("Y los clásicos, ordenados por demanda", paraLaSala.clasicos[0].demanda >= paraLaSala.clasicos[paraLaSala.clasicos.length - 1].demanda);

    await EquiposModel.guardarEquipo(claves[0], { nombre: "Cambiado", color1: "ABCDEF", color2: "000000", color3: "000000", colorTexto: "FFFFFF", angulo: 10, activo: false }, "prueba");
    const despues = (await EquiposModel.listar()).equipos.find((e) => e.clave === claves[0]);
    revisar("Se puede cambiar la camiseta", despues.color1 === "ABCDEF" && despues.activo === false, despues.color1);

    const sinApagados = await EquiposModel.paraLaSala();
    revisar("Un equipo apagado no le llega a la sala", !sinApagados.equipos.some((e) => e.clave === claves[0]));
    revisar("Y su clásico tampoco", !sinApagados.clasicos.some((c) => c.red === claves[0]));

    await EquiposModel.borrarClasico(clasico.id);
    await EquiposModel.borrarEquipo(claves[0]);
    revisar("Borrado el clásico, el equipo se puede borrar", !(await EquiposModel.listar()).equipos.some((e) => e.clave === claves[0]));

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

    const sinSesion = await pedir("/api/equipos");
    revisar("Sin sesión no se ven los equipos", sinSesion.status === 401, "HTTP " + sinSesion.status);

    const jugador = SesionModel.firmar({ nick: "SinRango" + Date.now(), admin: false });
    const comoJugador = await pedir("/api/equipos", { headers: { Authorization: "Bearer " + jugador } });
    revisar("Un jugador común tampoco", comoJugador.status === 403, "HTTP " + comoJugador.status);

    const RangoModel = require("../models/RangoModel");
    const rangos = await RangoModel.listar();
    const owner = rangos.find((r) => r.admin);
    const tokenOwner = SesionModel.firmar({ nick: (owner.nicks || [])[0] || "JINDER", rango: owner.nombre, admin: true });
    const comoOwner = await pedir("/api/equipos", { headers: { Authorization: "Bearer " + tokenOwner } });
    revisar("Un rango que configura sí los ve", comoOwner.status === 200 && Array.isArray(comoOwner.datos.equipos), "HTTP " + comoOwner.status);

    servidor.close();
  } finally {
    await base().clasico.deleteMany({ where: { OR: [{ red: { in: claves } }, { blue: { in: claves } }] } });
    await base().equipo.deleteMany({ where: { clave: { in: claves } } });
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
  console.log("✅ Equipos OK: las camisetas y los clásicos salen de la base y la sala los aplica en vivo");
  process.exit(0);
}
