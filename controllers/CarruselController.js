// CarruselController — las imágenes del carrusel de la portada.
// La portada lee /api/carrusel (público). Subir, editar, ordenar y borrar es del panel.
const CarruselModel = require("../models/CarruselModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  const noExiste = /Record to (update|delete) not found|No record was found|P2025/i.test(error.message + (error.code || ""));
  res.status(sinBase ? 503 : noExiste ? 404 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : noExiste ? "Esa imagen ya no existe" : error.message,
  });
};

class CarruselController {
  static publicas = async (req, res) => {
    try { res.json({ ok: true, imagenes: await CarruselModel.publicas() }); }
    catch (error) {
      // Sin base la portada no se rompe: carrusel vacío
      if (/No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message)) return res.json({ ok: true, imagenes: [] });
      responder(res, error);
    }
  };

  static todas = async (req, res) => {
    try { res.json({ ok: true, imagenes: await CarruselModel.todas(), maxBytes: CarruselModel.MAX_BYTES, tipos: CarruselModel.TIPOS }); }
    catch (error) { responder(res, error); }
  };

  // El cuerpo es la imagen tal cual (Content-Type: image/…). Los textos van en la query.
  static subir = async (req, res) => {
    try {
      const imagen = await CarruselModel.subir({
        buffer: Buffer.isBuffer(req.body) ? req.body : null,
        tipoDeclarado: String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase(),
        titulo: req.query.titulo,
        descripcion: req.query.descripcion,
        enlace: req.query.enlace,
        quien: req.usuario.nick,
      });
      res.status(201).json({ ok: true, imagen });
    } catch (error) { responder(res, error); }
  };

  static editar = async (req, res) => {
    try { res.json({ ok: true, imagen: await CarruselModel.editar(req.params.id, req.body || {}) }); }
    catch (error) { responder(res, error); }
  };

  static ordenar = async (req, res) => {
    try { res.json({ ok: true, imagenes: await CarruselModel.ordenar((req.body || {}).ids) }); }
    catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try { res.json(await CarruselModel.borrar(req.params.id)); }
    catch (error) { responder(res, error); }
  };

  // Sirve los bytes. nosniff: el navegador no puede tratarla como otra cosa que una imagen.
  static imagen = async (req, res) => {
    try {
      const imagen = await CarruselModel.imagen(req.params.id);
      if (!imagen) return res.status(404).send("no existe");
      res.setHeader("Content-Type", imagen.tipo);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(Buffer.from(imagen.datos));
    } catch (error) {
      res.status(503).send("no disponible");
    }
  };
}

module.exports = CarruselController;
