// AnimacionesController — las animaciones de gol.
// El catálogo lo arman SOLO el OWNER y el CO-OWNER (puedeVerRangos); comprar, vender y
// elegir piden sesión, y el nick sale del token, nunca del cuerpo del pedido.
const AnimacionesModel = require("../models/AnimacionesModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : error.message,
  });
};

class AnimacionesController {
  // ── Público ──
  static vitrina = async (_req, res) => {
    try { res.json({ ok: true, animaciones: await AnimacionesModel.vitrina() }); }
    catch (error) {
      // Sin base, la tienda se muestra vacía en vez de romper la página
      if (/base/i.test(error.message)) return res.json({ ok: true, animaciones: [] });
      responder(res, error);
    }
  };

  // ── Con sesión ──
  static mias = async (req, res) => {
    try { res.json({ ok: true, ...(await AnimacionesModel.deLaCuenta(req.usuario.nick)) }); }
    catch (error) { responder(res, error); }
  };

  static comprar = async (req, res) => {
    try { res.json({ ok: true, ...(await AnimacionesModel.comprar(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static vender = async (req, res) => {
    try { res.json({ ok: true, ...(await AnimacionesModel.vender(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static elegir = async (req, res) => {
    try { res.json({ ok: true, ...(await AnimacionesModel.elegir(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  // ── Solo OWNER y CO-OWNER ──
  static catalogo = async (_req, res) => {
    try {
      res.json({
        ok: true,
        animaciones: await AnimacionesModel.catalogo(),
        tipos: AnimacionesModel.TIPOS,
        maxCuadros: AnimacionesModel.MAX_CUADROS,
        limites: AnimacionesModel.LIMITES,
      });
    } catch (error) { responder(res, error); }
  };

  static guardar = async (req, res) => {
    try {
      const quien = req.usuario ? req.usuario.nick : null;
      res.json({ ok: true, animacion: await AnimacionesModel.guardar(req.params.clave, req.body || {}, quien) });
    } catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try { res.json({ ok: true, ...(await AnimacionesModel.borrar(req.params.clave)) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = AnimacionesController;
