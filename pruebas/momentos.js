// Prueba los carteles de los MOMENTOS del partido (arranque y victoria):
//
//   npm run prueba-momentos
//
// 1. En la sala: al arrancar el partido sale el cartel puesto, con la marca invisible que
//    mira la extensión, y sin él no sale nada. Y lo importante: ESO NO ES UN GOL.
// 2. Contra la base: crear, validar, los colores por letra y que solo uno quede puesto.
// 3. La API: es SOLO de OWNER y CO-OWNER (es configuración, no tienda).
//
// Usa claves con la hora adentro y borra todo lo que crea.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const MARCA_INICIO = "​‌";
const MARCA_VICTORIA = "​⁠";

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  // ── 1) En la sala ──
  console.log("🎬 En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, room, avanzar, entra, anuncios } = sala;

  entra(1, "Ana");
  avanzar(800);
  entra(2, "Beto");
  avanzar(3000);

  contexto.__INICIO = {
    clave: "arranca",
    plantilla: "⚽ ¡ARRANCA! {rojo} 🆚 {azul}",
    colores: ["FF0000", "00FF00"],
    color: "FFD700",
    estilo: "bold",
    sonido: 2,
  };

  // Ojo: el arranque automático ya puso un partido en marcha, y con uno en curso el
  // startGame() de HaxBall no hace nada. Hay que cortarlo antes.
  room.stopGame();
  avanzar(1000);
  anuncios.length = 0;
  room.startGame();
  avanzar(1500);

  const delInicio = anuncios.filter((a) => a.includes("¡ARRANCA!"));
  revisar("Al arrancar el partido sale el cartel de inicio", delInicio.length === 1, delInicio[0]);
  revisar("Lleva la marca invisible de la extensión",
    Boolean(delInicio[0]) && delInicio[0].endsWith(MARCA_INICIO),
    JSON.stringify(delInicio[0] || "").slice(-16));
  revisar("Y se le reemplazaron los huecos",
    Boolean(delInicio[0]) && !delInicio[0].includes("{"), delInicio[0]);

  // Sin cartel puesto (sin base, por ejemplo) no sale nada: la sala nunca se rompe por esto
  room.stopGame();
  avanzar(1000);
  contexto.__INICIO = null;
  anuncios.length = 0;
  room.startGame();
  avanzar(1500);
  revisar("Sin cartel puesto no sale ninguno", !anuncios.some((a) => a.includes("¡ARRANCA!")));

  // El cartel de la VICTORIA, que reemplaza al "Red is Victorious!" de HaxBall
  contexto.__VICTORIA = {
    clave: "gano",
    plantilla: "🏆 ¡GANÓ {ganador}! {golesGanador} 🆚 {golesPerdedor} {perdedor}",
    color: "FFD700", estilo: "bold", sonido: 2,
  };
  anuncios.length = 0;
  room.onTeamVictory({ red: 3, blue: 1 });
  avanzar(1500);
  const deVictoria = anuncios.filter((a) => a.includes("¡GANÓ"));
  revisar("Al terminar el partido sale el cartel de victoria", deVictoria.length === 1, deVictoria[0]);
  revisar("Con su propia marca invisible",
    Boolean(deVictoria[0]) && deVictoria[0].endsWith(MARCA_VICTORIA),
    JSON.stringify(deVictoria[0] || "").slice(-14));
  revisar("Y con el resultado bien puesto",
    Boolean(deVictoria[0]) && deVictoria[0].includes("3") && deVictoria[0].includes("1"), deVictoria[0]);

  // ── 2) Contra la base ──
  console.log("\n🗃️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada: se saltea esta parte.");
  } else {
    const MomentosModel = require("../models/MomentosModel");
    const clave = "prueba-" + Date.now().toString().slice(-6);
    const otra = clave + "-b";
    const antesPuesto = await MomentosModel.elPuesto("inicio");

    try {
      const guardado = await MomentosModel.guardar(clave, {
        momento: "inicio",
        nombre: "Prueba de inicio",
        plantilla: "🎬 EMPIEZA {rojo} contra {azul}",
        colores: ["FF0000", "#00ff00", "no-es-color"],
        color: "#FFD700",
        estilo: "bold",
      }, "PRUEBA");
      revisar("Se guarda y arma el ejemplo", guardado.ejemplo.includes("OLIMPIA"), guardado.ejemplo);
      revisar("Los colores se normalizan (sin #, en mayúsculas)",
        guardado.colores[0] === "FF0000" && guardado.colores[1] === "00FF00", JSON.stringify(guardado.colores));
      revisar("Un color inventado se cae al general", guardado.colores[2] === "FFD700", guardado.colores[2]);
      revisar("Hay un color por cada letra del texto",
        guardado.coloresDelEjemplo.length === guardado.ejemplo.length,
        guardado.coloresDelEjemplo.length + " colores para " + guardado.ejemplo.length + " letras");
      revisar("Las letras que sobran usan el último color",
        guardado.coloresDelEjemplo[guardado.ejemplo.length - 1] === "FFD700");

      let error = null;
      try { await MomentosModel.guardar(clave, { nombre: "", plantilla: "hola" }); }
      catch (e) { error = e.message; }
      revisar("Sin nombre no se guarda", /nombre/i.test(error || ""), error);

      error = null;
      try { await MomentosModel.guardar(clave, { nombre: "Algo", plantilla: "" }); }
      catch (e) { error = e.message; }
      revisar("Sin texto no se guarda", /cómo se ve/i.test(error || ""), error);

      // Solo uno puede estar puesto
      await MomentosModel.guardar(otra, { momento: "inicio", nombre: "Prueba dos", plantilla: "otro" }, "PRUEBA");
      await MomentosModel.poner(clave);
      await MomentosModel.poner(otra);
      const puestos = (await MomentosModel.catalogo("inicio")).filter((i) => i.puesto);
      revisar("Solo queda uno puesto", puestos.length === 1, puestos.map((p) => p.clave).join(", "));
      revisar("Y es el último que se eligió", puestos[0].clave === otra, puestos[0].clave);

      // Los momentos no se pisan entre sí: el de victoria sigue puesto igual
      const victoria = await MomentosModel.elPuesto("victoria");
      revisar("El de victoria es otro y sigue puesto", Boolean(victoria) && victoria.momento === "victoria",
        victoria && victoria.clave);
      revisar("Y tiene sus propios huecos",
        MomentosModel.huecos("victoria").some((h) => h.hueco === "{ganador}"));

      const elPuesto = await MomentosModel.elPuesto("inicio");
      revisar("elPuesto() devuelve ese", elPuesto && elPuesto.clave === otra, elPuesto && elPuesto.clave);
    } finally {
      // Se deja todo como estaba
      for (const c of [clave, otra]) {
        try { await base().cartelMomento.delete({ where: { clave: c } }); } catch (e) {}
      }
      if (antesPuesto) { try { await MomentosModel.poner(antesPuesto.clave); } catch (e) {} }
    }
  }

  // ── 3) La API: solo OWNER y CO-OWNER ──
  console.log("\n🔐 La API:\n");
  const http = require("http");
  const { crearApp } = require("../app");
  const servidor = http.createServer(crearApp({ salas: [] }));
  await new Promise((listo) => servidor.listen(0, listo));
  const puerto = servidor.address().port;
  const pedir = async (ruta, opciones = {}) => {
    const r = await fetch("http://localhost:" + puerto + ruta, opciones);
    return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
  };

  const sinSesion = await pedir("/api/momentos/inicio");
  revisar("Sin sesión no se puede ver", sinSesion.estado === 401, "HTTP " + sinSesion.estado);
  const guardarSinSesion = await pedir("/api/momentos/inicio/loquesea", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "x" }),
  });
  revisar("Sin sesión no se puede guardar", guardarSinSesion.estado === 401, "HTTP " + guardarSinSesion.estado);
  await new Promise((listo) => servidor.close(listo));

  await cerrarBase().catch(() => {});
  console.log(problemas.length ? "\n❌ Falló: " + problemas.join(" · ") : "\n✅ Cartel de inicio OK");
  process.exit(problemas.length ? 1 : 0);
})();
