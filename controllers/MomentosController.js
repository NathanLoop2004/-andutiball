// MomentosController — los carteles del ARRANQUE y de la VICTORIA del partido.
// Son configuración, no tienda: los tocan SOLO el OWNER y el CO-OWNER (puedeVerRangos).
const MomentosModel = require("../models/MomentosModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : error.message,
  });
};

class MomentosController {
  // Los de un momento (inicio · victoria), con sus huecos y su plantilla de ejemplo
  static catalogo = async (req, res) => {
    try {
      const momento = req.params.momento;
      res.json({
        ok: true,
        momento,
        carteles: await MomentosModel.catalogo(momento),
        huecos: MomentosModel.huecos(momento),
        largoMaximo: MomentosModel.LARGO_MAXIMO,
        plantillaDeEjemplo: MomentosModel.plantillaDeEjemplo(momento),
      });
    } catch (error) { responder(res, error); }
  };

  static guardar = async (req, res) => {
    try {
      const quien = req.usuario && req.usuario.nick;
      const datos = Object.assign({}, req.body || {}, { momento: req.params.momento });
      res.json({ ok: true, cartel: await MomentosModel.guardar(req.params.clave, datos, quien) });
    } catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try { res.json({ ok: true, ...(await MomentosModel.borrar(req.params.clave)) }); }
    catch (error) { responder(res, error); }
  };

  static poner = async (req, res) => {
    try { res.json({ ok: true, cartel: await MomentosModel.poner(req.params.clave) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = MomentosController;
