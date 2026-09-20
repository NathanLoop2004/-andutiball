// Prueba las novedades para el Discord: se guardan en la tabla `actualizaciones`,
// quedan pendientes, y recién cuando alguien las manda salen al webhook.
//
//   npm run prueba-actualizaciones
//
// NO manda nada al Discord de verdad: se reemplaza el envío por uno de mentira y se
// revisa qué le habría llegado. Si la base no está levantada, avisa y sale bien.

const WebhookActualizaciones = require("../services/WebhookActualizaciones");
const ActualizacionModel = require("../models/ActualizacionModel");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const { crearApp } = require("../app");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// El envío de mentira: guardamos lo que se habría mandado
const mandados = [];
const envioReal = WebhookActualizaciones.enviar;
WebhookActualizaciones.enviar = async (novedad) => {
  if (novedad.mensaje.includes("ROMPETE")) throw new Error("Discord respondió 400");
  mandados.push(novedad);
  return { ok: true };
};

const escuchar = (app) => new Promise((listo) => {
  const servidor = app.listen(0, () => listo({ servidor, url: `http://127.0.0.1:${servidor.address().port}` }));
});
const pedir = async (url, opciones) => {
  const res = await fetch(url, opciones);
  return { status: res.status, datos: await res.json().catch(() => ({})) };
};
const json = (cuerpo) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

(async () => {
  console.log("📣 Novedades para el Discord:\n");

  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos.");
    console.log("      👉 npm run base   y después   npm run base:migrar\n");
    await cerrarBase().catch(() => {});
    console.log("✅ (sin base, no se probó nada)");
    return;
  }

  const marca = "prueba-" + Date.now();
  const api = await escuchar(crearApp({ salas: [] }));

  // ── Se guarda, no se manda ──
  const alta = await pedir(`${api.url}/api/actualizaciones`, json({ mensaje: `${marca} arranca solo con 2 jugadores` }));
  revisar("Se guarda y queda pendiente", alta.status === 201 && alta.datos.actualizacion.estado === "pendiente", alta.datos.actualizacion?.estado);
  revisar("Guardarla NO la manda al Discord", mandados.length === 0, mandados.length + " mandadas");

  const id = alta.datos.actualizacion.id;

  const vacia = await pedir(`${api.url}/api/actualizaciones`, json({ mensaje: "   " }));
  revisar("Una novedad vacía no se guarda", vacia.status === 400, vacia.datos.error);

  // ── Recién ahora se manda ──
  const envio = await pedir(`${api.url}/api/actualizaciones/${id}/enviar`, { method: "POST" });
  revisar("Al enviarla sale al Discord", envio.status === 200 && mandados.length === 1, mandados.length + " mandadas");
  revisar("Queda marcada como enviada, con fecha", envio.datos.actualizacion.estado === "enviada" && Boolean(envio.datos.actualizacion.enviada), envio.datos.actualizacion.estado);
  revisar("Se manda el texto tal cual, sin agregarle nada", mandados[0].mensaje === `${marca} arranca solo con 2 jugadores`, mandados[0].mensaje);

  const repetida = await pedir(`${api.url}/api/actualizaciones/${id}/enviar`, { method: "POST" });
  revisar("No se manda dos veces", repetida.status === 400 && mandados.length === 1, repetida.datos.error);

  // ── Si el Discord falla, queda anotado ──
  const rota = await pedir(`${api.url}/api/actualizaciones`, json({ mensaje: `${marca} ROMPETE` }));
  const fallo = await pedir(`${api.url}/api/actualizaciones/${rota.datos.actualizacion.id}/enviar`, { method: "POST" });
  revisar("Si el Discord falla, la novedad queda en error", fallo.status === 400, fallo.datos.error);
  const guardadaRota = await base().actualizacion.findUnique({ where: { id: rota.datos.actualizacion.id } });
  revisar("Y se guarda el motivo para verlo en el panel", guardadaRota.estado === "error" && Boolean(guardadaRota.error), guardadaRota.error);

  // ── El envío de verdad arma un embed limpio ──
  WebhookActualizaciones.enviar = envioReal;
  const pedidos = [];
  const fetchReal = global.fetch;
  global.fetch = async (url, opciones) => { pedidos.push({ url, cuerpo: JSON.parse(opciones.body) }); return { ok: true, status: 204, text: async () => "" }; };
  process.env.WEBHOOK_ACTUALIZACIONES = "https://discord.com/api/webhooks/1/x";
  await WebhookActualizaciones.enviar({ titulo: null, mensaje: "Ahora el partido arranca solo" });
  global.fetch = fetchReal;

  const embed = pedidos[0].cuerpo.embeds[0];
  revisar("Va como tarjeta con el texto de la novedad", embed.description === "Ahora el partido arranca solo", embed.description);
  revisar("Sin título propio usa uno lindo por defecto", embed.title === "📣 Novedades de ÑandutíHax", embed.title);
  revisar("No se le cuela nada técnico", !/commit|prisma|\.js|id=|null/i.test(JSON.stringify(pedidos[0].cuerpo)), "limpio");

  // Limpieza: borramos lo que dejó la prueba
  await base().actualizacion.deleteMany({ where: { mensaje: { contains: marca } } });
  api.servidor.close();
  await cerrarBase().catch(() => {});

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Actualizaciones OK: se guardan primero y salen al Discord recién cuando se las manda");
})();
