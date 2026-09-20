// Prueba las rachas de victorias:
//
//   npm run prueba-rachas
//
// · Ganar suma a la racha; perder o empatar la corta.
// · Se guarda la mejor racha de cada uno, con la fecha.
// · La portada las pide por /api/rachas, sin sesión.
//
// Usa nicks de prueba con una marca de la hora y los borra al final.

const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  console.log("🔥 Rachas:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const RachasModel = require("../models/RachasModel");
  const marca = Date.now();
  const gana = "Racha" + marca;
  const pierde = "Pierde" + marca;

  try {
    // Tres seguidas
    let novedades;
    for (let i = 1; i <= 3; i++) novedades = await RachasModel.anotarPartido({ ganadores: [gana], perdedores: [pierde] });

    const suya = await RachasModel.deNick(gana);
    revisar("Ganar seguido suma la racha", suya.actual === 3 && suya.mejor === 3, `${suya.actual} seguidas, mejor ${suya.mejor}`);
    revisar("Se avisa cuando llega a 3", novedades.some((n) => n.nick === gana && (n.premio || n.record)), JSON.stringify(novedades[0]));
    revisar("Y queda la fecha de la mejor", Boolean(suya.cuando));

    const delOtro = await RachasModel.deNick(pierde);
    revisar("Al que pierde no le suma nada", delOtro.actual === 0 && delOtro.mejor === 0 && delOtro.partidos === 3);

    // Se le corta
    const corte = await RachasModel.anotarPartido({ ganadores: [pierde], perdedores: [gana] });
    const cortada = await RachasModel.deNick(gana);
    revisar("Perder corta la racha, pero la mejor queda", cortada.actual === 0 && cortada.mejor === 3, `ahora ${cortada.actual}, mejor ${cortada.mejor}`);
    revisar("Y se avisa que se le cortó", corte.some((n) => n.nick === gana && n.cortada === 3), JSON.stringify(corte));

    // Vuelve a ganar: la mejor no baja
    await RachasModel.anotarPartido({ ganadores: [gana], perdedores: [pierde] });
    const devuelta = await RachasModel.deNick(gana);
    revisar("Al volver a ganar arranca de nuevo en 1", devuelta.actual === 1 && devuelta.mejor === 3);

    // Superar la mejor
    for (let i = 0; i < 3; i++) await RachasModel.anotarPartido({ ganadores: [gana], perdedores: [pierde] });
    const record = await RachasModel.deNick(gana);
    revisar("Si supera su mejor, se guarda la nueva", record.actual === 4 && record.mejor === 4, `${record.actual} seguidas`);

    const mejores = await RachasModel.mejores(10);
    revisar("Aparece en las mejores rachas", mejores.some((m) => m.nick === gana && m.mejor === 4), mejores.length + " en la tabla");
    revisar("Y vienen ordenadas de mayor a menor", mejores.every((m, i) => i === 0 || mejores[i - 1].mejor >= m.mejor));

    const vivas = await RachasModel.enCurso(5);
    revisar("Las que están vivas se pueden mirar aparte", vivas.some((v) => v.nick === gana && v.actual === 4));

    // ── La API, sin sesión ──
    const { crearApp } = require("../app");
    const servidor = await new Promise((listo) => {
      const s = require("http").createServer(crearApp({ salas: [] }));
      s.listen(0, () => listo(s));
    });
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/api/rachas?limite=5`);
    const datos = await r.json();
    revisar("La portada las puede pedir sin sesión", r.status === 200 && Array.isArray(datos.mejores) && datos.mejores.length > 0, "HTTP " + r.status);
    revisar("No se filtra nada de más (solo nick y números)",
      Object.keys(datos.mejores[0]).every((k) => ["puesto", "nick", "mejor", "actual", "partidos", "ganados", "cuando"].includes(k)),
      Object.keys(datos.mejores[0]).join(", "));
    servidor.close();
  } finally {
    await base().racha.deleteMany({ where: { nick: { in: [gana, pierde] } } });
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
  console.log("✅ Rachas OK: se suman al ganar, se cortan al perder y queda la mejor de cada uno");
  process.exit(0);
}
