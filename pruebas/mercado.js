// Prueba el mercado de la tienda: historial de precios, cuántos compraron y favoritos.
//
//   npm run prueba-mercado
//
// · El historial guarda un punto SOLO cuando el precio cambia (si no, se llenaría de repetidos).
// · Los números de comprados y favoritos salen de las tablas de verdad.
// · Los favoritos se ponen y se sacan con el mismo pedido.
// · La ficha es pública, pero NUNCA dice quiénes marcaron favorito: solo cuántos.
// · Marcar favorito pide sesión, y el nick sale del token.
//
// Usa claves y nicks con la hora adentro, y borra todo lo que crea.

const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  console.log("🏷️  El mercado:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const MercadoModel = require("../models/MercadoModel");
  const AnimacionesModel = require("../models/AnimacionesModel");
  const MonedasModel = require("../models/MonedasModel");

  const clave = "merc" + String(Date.now()).slice(-6);
  const uno = "Merc" + Date.now();
  const dos = "Merd" + (Date.now() + 1);

  try {
    // ── El historial ──
    for (const precio of [2, 2, 5, 3]) {   // el 2 repetido no tiene que anotarse dos veces
      await AnimacionesModel.guardar(clave, {
        nombre: "De mercado", cuadros: ["⚽", "🔥"], tamanos: [1, 1.5], msPorCuadro: 250, precio, enTienda: true,
      }, "prueba");
    }
    const historial = await MercadoModel.historial("animacion", clave);
    revisar("Solo se anota cuando el precio CAMBIA", historial.length === 3, historial.map((h) => h.precio).join(" → "));
    revisar("Y queda en orden, del más viejo al más nuevo",
      historial[0].precio === 2 && historial[2].precio === 3, historial.map((h) => h.precio).join(" → "));

    // ── Comprados ──
    for (const n of [uno, dos]) {
      await base().usuario.create({ data: { nick: n, clave: "scrypt$prueba$prueba" } });
      await MonedasModel.acreditar({ nick: n, monto: MonedasModel.aCentesimas(20), motivo: "prueba" });
      await AnimacionesModel.comprar(n, clave);
    }
    revisar("Cuenta bien cuántos la compraron", (await MercadoModel.cuantosCompraron("animacion", clave)) === 2);

    // ── Favoritos ──
    const puesto = await MercadoModel.marcarFavorito(uno, "animacion", clave);
    revisar("Marcar favorito lo prende y devuelve el número", puesto.esFavorito === true && puesto.favoritos === 1, JSON.stringify(puesto));
    await MercadoModel.marcarFavorito(dos, "animacion", clave);
    revisar("Y suma el de otra persona", (await MercadoModel.cuantosFavoritos("animacion", clave)) === 2);
    const sacado = await MercadoModel.marcarFavorito(uno, "animacion", clave);
    revisar("El mismo pedido lo saca", sacado.esFavorito === false && sacado.favoritos === 1, JSON.stringify(sacado));

    // ── La ficha ──
    const ficha = await MercadoModel.ficha("animacion", clave, dos);
    revisar("La ficha trae todo junto",
      ficha.compraron === 2 && ficha.favoritos === 1 && ficha.esFavorito === true && ficha.cambiosDePrecio === 2,
      JSON.stringify({ compraron: ficha.compraron, favoritos: ficha.favoritos, cambios: ficha.cambiosDePrecio }));
    revisar("Dice lo más barato y lo más caro que estuvo", ficha.masBarato === 2 && ficha.masCaro === 5, ficha.masBarato + " → " + ficha.masCaro);
    revisar("NUNCA dice quiénes marcaron favorito", !JSON.stringify(ficha).includes(uno) && !JSON.stringify(ficha).includes(dos));

    let tipoMalo = null;
    try { await MercadoModel.ficha("cualquiera", clave); } catch (e) { tipoMalo = e.message; }
    revisar("Un tipo inventado se rechaza", /nada de lo que se vende/.test(tipoMalo || ""), tipoMalo);

    // ── La API ──
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

    const publica = await pedir("/api/mercado/animacion/" + clave);
    revisar("La ficha la ve cualquiera, sin sesión", publica.status === 200 && publica.datos.compraron === 2, "HTTP " + publica.status);
    revisar("Y sin sesión no dice que sea favorito de nadie", publica.datos.esFavorito === false);

    const sinSesion = await pedir("/api/favoritos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "animacion", clave }),
    });
    revisar("Marcar favorito pide sesión", sinSesion.status === 401, "HTTP " + sinSesion.status);

    const token = SesionModel.firmar({ nick: uno, admin: false });
    const conSesion = await pedir("/api/favoritos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ tipo: "animacion", clave }),
    });
    revisar("Con sesión sí", conSesion.status === 200 && conSesion.datos.esFavorito === true, "HTTP " + conSesion.status);

    const conToken = await pedir("/api/mercado/animacion/" + clave, { headers: { Authorization: "Bearer " + token } });
    revisar("Con sesión, la ficha dice si es tuyo", conToken.datos.esFavorito === true);

    servidor.close();
  } finally {
    for (const n of [uno, dos]) {
      await base().animacionComprada.deleteMany({ where: { nick: n } });
      await base().movimientoMonedas.deleteMany({ where: { nick: n } });
      await base().monedas.deleteMany({ where: { nick: n } });
      await base().favorito.deleteMany({ where: { nick: n } });
      await base().usuario.deleteMany({ where: { nick: n } });
    }
    await base().animacion.deleteMany({ where: { clave } });
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
  console.log("✅ El mercado OK: historial de precios, comprados y favoritos");
}
