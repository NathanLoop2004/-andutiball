// TiendaController — la tienda de camisetas y el inventario de cada cuenta.
const TiendaModel = require("../models/TiendaModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message, sinBase });
};

class TiendaController {
  // Público: lo que se ve en el carrusel de la portada
  static vitrina = async (_req, res) => {
    try { res.json({ ok: true, camisetas: await TiendaModel.vitrina() }); }
    catch (error) {
      if (/No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message)) return res.json({ ok: true, camisetas: [] });
      responder(res, error);
    }
  };

  // Con sesión: el inventario de esa cuenta
  static mias = async (req, res) => {
    try { res.json({ ok: true, ...(await TiendaModel.deLaCuenta(req.usuario.nick)) }); }
    catch (error) { responder(res, error); }
  };

  static comprar = async (req, res) => {
    try { res.json({ ok: true, ...(await TiendaModel.comprar(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static vender = async (req, res) => {
    try { res.json({ ok: true, ...(await TiendaModel.vender(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static elegir = async (req, res) => {
    try { res.json({ ok: true, ...(await TiendaModel.elegir(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  // Solo OWNER y CO-OWNER: poner precios
  static paraElPanel = async (_req, res) => {
    try { res.json({ ok: true, camisetas: await TiendaModel.paraElPanel() }); }
    catch (error) { responder(res, error); }
  };

  static ponerPrecio = async (req, res) => {
    try { res.json({ ok: true, camiseta: await TiendaModel.ponerPrecio(req.params.clave, req.body || {}, req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = TiendaController;
