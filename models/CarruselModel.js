// =============================================================================
// CarruselModel — las imágenes del carrusel de la portada (tabla imagenes_carrusel).
//
// La imagen se guarda en la base. Al subirla se revisa que sea de verdad una imagen:
//   · solo PNG, JPEG, WebP o GIF (nada de SVG: puede traer código adentro);
//   · se miran los primeros bytes del archivo (la "firma"), no solo lo que dice el navegador;
//   · hasta MAX_BYTES.
// El enlace opcional solo puede ser http(s), para que nadie meta un "javascript:".
// =============================================================================
const { base } = require("../services/ConexionBase");

const MAX_BYTES = 3 * 1024 * 1024;   // 3 MB
const MAX_IMAGENES = 20;

// Cómo empieza cada formato
const FIRMAS = {
  "image/png": (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.length > 6 && b.toString("ascii", 0, 4) === "GIF8",
  "image/webp": (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

const TIPOS = Object.keys(FIRMAS);

function detectarTipo(buffer) {
  return TIPOS.find((t) => FIRMAS[t](buffer)) || null;
}

function limpiarTexto(texto, max) {
  const t = String(texto == null ? "" : texto).replace(/[\r\n]+/g, " ").trim();
  if (t.length > max) throw new Error(`Máximo ${max} caracteres`);
  return t || null;
}

function limpiarEnlace(enlace) {
  const t = String(enlace == null ? "" : enlace).trim();
  if (!t) return null;
  let url;
  try { url = new URL(t); } catch (e) { throw new Error("El enlace no es una dirección válida"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("El enlace tiene que empezar con http:// o https://");
  if (t.length > 500) throw new Error("El enlace es demasiado largo");
  return url.toString();
}

// Lo que se muestra de una imagen (sin los bytes)
const ficha = (i) => ({
  id: i.id,
  titulo: i.titulo,
  descripcion: i.descripcion,
  enlace: i.enlace,
  tipo: i.tipo,
  tamano: i.tamano,
  orden: i.orden,
  activa: i.activa,
  subidaPor: i.subidaPor,
  creada: i.creada,
  cambiada: i.cambiada,
  // ?v= cambia cuando se reemplaza la imagen, así el navegador no muestra la vieja
  url: `/api/carrusel/${i.id}/imagen?v=${new Date(i.cambiada).getTime()}`,
});

const SIN_DATOS = { id: true, titulo: true, descripcion: true, enlace: true, tipo: true, tamano: true, orden: true, activa: true, subidaPor: true, creada: true, cambiada: true };

class CarruselModel {
  static MAX_BYTES = MAX_BYTES;
  static TIPOS = TIPOS;
  static detectarTipo = detectarTipo;

  // Para la portada: solo las activas, en orden
  static async publicas() {
    const lista = await base().imagenCarrusel.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { id: "asc" }], select: SIN_DATOS });
    return lista.map(ficha);
  }

  // Para el panel: todas
  static async todas() {
    const lista = await base().imagenCarrusel.findMany({ orderBy: [{ orden: "asc" }, { id: "asc" }], select: SIN_DATOS });
    return lista.map(ficha);
  }

  static async subir({ buffer, tipoDeclarado, titulo, descripcion, enlace, quien }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("No llegó ninguna imagen");
    if (buffer.length > MAX_BYTES) throw new Error("La imagen pesa más de 3 MB");
    const tipo = detectarTipo(buffer);
    if (!tipo) throw new Error("Ese archivo no es una imagen PNG, JPG, WebP o GIF");
    if (tipoDeclarado && tipoDeclarado !== tipo && !(tipoDeclarado === "image/jpg" && tipo === "image/jpeg")) {
      throw new Error("El archivo no coincide con su tipo");
    }
    const cantidad = await base().imagenCarrusel.count();
    if (cantidad >= MAX_IMAGENES) throw new Error(`Ya hay ${MAX_IMAGENES} imágenes: borrá alguna antes de subir otra`);

    const ultima = await base().imagenCarrusel.findFirst({ orderBy: { orden: "desc" }, select: { orden: true } });
    const creada = await base().imagenCarrusel.create({
      data: {
        titulo: limpiarTexto(titulo, 80),
        descripcion: limpiarTexto(descripcion, 200),
        enlace: limpiarEnlace(enlace),
        tipo,
        tamano: buffer.length,
        datos: buffer,
        orden: ultima ? ultima.orden + 1 : 0,
        subidaPor: quien || null,
      },
      select: SIN_DATOS,
    });
    return ficha(creada);
  }

  static async editar(id, { titulo, descripcion, enlace, activa }) {
    const datos = {};
    if (titulo !== undefined) datos.titulo = limpiarTexto(titulo, 80);
    if (descripcion !== undefined) datos.descripcion = limpiarTexto(descripcion, 200);
    if (enlace !== undefined) datos.enlace = limpiarEnlace(enlace);
    if (activa !== undefined) datos.activa = Boolean(activa);
    const imagen = await base().imagenCarrusel.update({ where: { id: Number(id) }, data: datos, select: SIN_DATOS });
    return ficha(imagen);
  }

  // ids en el orden nuevo
  static async ordenar(ids) {
    if (!Array.isArray(ids) || !ids.length) throw new Error("Falta el orden");
    const numeros = ids.map(Number);
    if (numeros.some((n) => !Number.isInteger(n))) throw new Error("Orden no válido");
    await base().$transaction(numeros.map((id, orden) => base().imagenCarrusel.update({ where: { id }, data: { orden } })));
    return CarruselModel.todas();
  }

  static async borrar(id) {
    await base().imagenCarrusel.delete({ where: { id: Number(id) } });
    return { ok: true };
  }

  // Los bytes, para servir la imagen
  static async imagen(id) {
    const n = Number(id);
    if (!Number.isInteger(n)) return null;
    return base().imagenCarrusel.findUnique({ where: { id: n }, select: { tipo: true, datos: true, activa: true } });
  }
}

module.exports = CarruselModel;
