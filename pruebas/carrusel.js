// Prueba el carrusel de la portada: la tabla de imágenes, la API y los permisos.
//
//   npm run prueba-carrusel
//
// Si la base no está levantada, avisa y sale bien. Deja la tabla como estaba.

const { crearApp } = require("../app");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const CarruselModel = require("../models/CarruselModel");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// Un PNG de verdad de 1×1 (la firma es lo que se revisa)
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cf00000301010018dd8db40000000049454e44ae426082", "hex");
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

(async () => {
  console.log("🖼️  Detectar el tipo por los bytes:\n");
  revisar("Reconoce un PNG", CarruselModel.detectarTipo(PNG) === "image/png");
  revisar("Reconoce un JPG", CarruselModel.detectarTipo(JPG) === "image/jpeg");
  revisar("Un SVG no es una imagen permitida", CarruselModel.detectarTipo(SVG) === null);

  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const antes = await base().imagenCarrusel.findMany({ select: { id: true } });
  const idsAntes = new Set(antes.map((i) => i.id));
  const nuevas = [];

  try {
    const svg = await CarruselModel.subir({ buffer: SVG, tipoDeclarado: "image/png", quien: "prueba" }).catch((e) => e);
    revisar("No deja subir un SVG disfrazado de PNG", svg instanceof Error, svg.message);
    const mentira = await CarruselModel.subir({ buffer: PNG, tipoDeclarado: "image/gif", quien: "prueba" }).catch((e) => e);
    revisar("No deja subir un archivo que no coincide con su tipo", mentira instanceof Error, mentira.message);
    const grande = await CarruselModel.subir({ buffer: Buffer.concat([PNG, Buffer.alloc(CarruselModel.MAX_BYTES)]), tipoDeclarado: "image/png", quien: "prueba" }).catch((e) => e);
    revisar("No deja subir más de 3 MB", grande instanceof Error && /3 MB/.test(grande.message), grande.message);
    const js = await CarruselModel.subir({ buffer: PNG, tipoDeclarado: "image/png", enlace: "javascript:alert(1)", quien: "prueba" }).catch((e) => e);
    revisar("No acepta enlaces javascript:", js instanceof Error && /http/.test(js.message), js.message);

    const a = await CarruselModel.subir({ buffer: PNG, tipoDeclarado: "image/png", titulo: "Torneo", descripcion: "Inscripciones abiertas", enlace: "https://discord.gg/TGRug4BGG", quien: "prueba" });
    const b = await CarruselModel.subir({ buffer: JPG, tipoDeclarado: "image/jpeg", titulo: "Segunda", quien: "prueba" });
    nuevas.push(a.id, b.id);
    revisar("Sube una imagen con título, texto y enlace", a.id && a.titulo === "Torneo" && a.enlace === "https://discord.gg/TGRug4BGG" && a.tipo === "image/png");
    revisar("Lo que devuelve no trae los bytes", !("datos" in a) && /\/api\/carrusel\/\d+\/imagen\?v=/.test(a.url), a.url);
    revisar("La segunda va después en el orden", b.orden > a.orden, `${a.orden} → ${b.orden}`);

    const guardada = await base().imagenCarrusel.findUnique({ where: { id: a.id } });
    revisar("La imagen queda guardada en la base", Buffer.from(guardada.datos).equals(PNG), guardada.tamano + " bytes");

    // ── La API ──
    console.log("\n🌐 La API:\n");
    const servidor = await new Promise((listo) => { const s = crearApp({ salas: [] }).listen(0, () => listo(s)); });
    const url = "http://127.0.0.1:" + servidor.address().port;
    const SesionModel = require("../models/SesionModel");
    const RangoModel = require("../models/RangoModel");
    const Permisos = require("../lib/permisos");
    const claves = require("../lib/claves");
    const nick = "Carrusel" + Date.now();
    await base().usuario.create({ data: { nick, clave: claves.hashear("clave1234") } });
    const token = SesionModel.firmar({ nick, rango: null, admin: false });
    const pedir = async (ruta, opciones = {}) => {
      const r = await fetch(url + ruta, { ...opciones, headers: { Authorization: "Bearer " + token, ...(opciones.headers || {}) } });
      const tipo = r.headers.get("content-type") || "";
      return { status: r.status, headers: r.headers, datos: tipo.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };

    try {
      const publica = await fetch(url + "/api/carrusel").then((r) => r.json());
      revisar("La portada ve las imágenes sin iniciar sesión", publica.imagenes.some((i) => i.id === a.id));

      await CarruselModel.editar(b.id, { activa: false });
      const sinInactiva = await fetch(url + "/api/carrusel").then((r) => r.json());
      revisar("La portada no ve las desactivadas", !sinInactiva.imagenes.some((i) => i.id === b.id));

      const img = await fetch(url + "/api/carrusel/" + a.id + "/imagen");
      const bytes = Buffer.from(await img.arrayBuffer());
      revisar("Sirve la imagen con su tipo", img.status === 200 && img.headers.get("content-type") === "image/png" && bytes.equals(PNG));
      revisar("Con nosniff (el navegador no la trata como otra cosa)", img.headers.get("x-content-type-options") === "nosniff");

      const sinSesion = await fetch(url + "/api/carrusel/todas");
      revisar("El panel del carrusel pide sesión", sinSesion.status === 401, "HTTP " + sinSesion.status);
      const jugador = await pedir("/api/carrusel/todas");
      revisar("Un jugador sin rango no puede administrarlo", jugador.status === 403, "HTTP " + jugador.status);
      const subeJugador = await pedir("/api/carrusel", { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });
      revisar("Ni subir imágenes", subeJugador.status === 403, "HTTP " + subeJugador.status);

      const rangos = await RangoModel.listar();
      const ayudante = rangos.find((r) => Permisos.palabraDelRango(r.nombre) === "AYUDANTE");
      await RangoModel.asignarNick({ nombreRango: ayudante.nombre, nick });

      const todas = await pedir("/api/carrusel/todas");
      revisar("AYUDANTE ve todas, también las desactivadas", todas.status === 200 && todas.datos.imagenes.some((i) => i.id === b.id));
      const subida = await pedir("/api/carrusel?titulo=" + encodeURIComponent("Desde la API"), { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });
      if (subida.datos.imagen) nuevas.push(subida.datos.imagen.id);
      revisar("AYUDANTE puede subir (la imagen va tal cual en el cuerpo)", subida.status === 201 && subida.datos.imagen.titulo === "Desde la API", "HTTP " + subida.status);
      const svgApi = await pedir("/api/carrusel", { method: "POST", headers: { "Content-Type": "image/png" }, body: SVG });
      revisar("Por la API tampoco entra un SVG", svgApi.status === 400, svgApi.datos.error);
      const orden = await pedir("/api/carrusel/orden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [b.id, a.id] }) });
      const posA = orden.datos.imagenes.findIndex((i) => i.id === a.id);
      const posB = orden.datos.imagenes.findIndex((i) => i.id === b.id);
      revisar("Puede cambiar el orden", orden.status === 200 && posB < posA);
      const editada = await pedir("/api/carrusel/" + a.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo: "Cambiado", enlace: "" }) });
      revisar("Puede editar el título y sacar el enlace", editada.status === 200 && editada.datos.imagen.titulo === "Cambiado" && editada.datos.imagen.enlace === null);
      const borrada = await pedir("/api/carrusel/" + b.id, { method: "DELETE" });
      const yaNo = await fetch(url + "/api/carrusel/" + b.id + "/imagen");
      revisar("Puede borrar, y la imagen deja de existir", borrada.status === 200 && yaNo.status === 404);
      await RangoModel.quitarNick(nick);
    } finally {
      await RangoModel.quitarNick(nick).catch(() => {});
      await base().usuario.deleteMany({ where: { nick } });
      servidor.close();
    }
  } finally {
    // Solo se borra lo que creó la prueba
    await base().imagenCarrusel.deleteMany({ where: { id: { in: nuevas.filter((id) => !idsAntes.has(id)) } } });
    const quedan = await base().imagenCarrusel.count();
    revisar("La tabla queda como estaba", quedan === antes.length, quedan + " imágenes");
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
  console.log("✅ Carrusel OK: imágenes seguras, portada pública y panel con permisos");
  process.exit(0);
}
