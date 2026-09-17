// RangosController — leer y guardar los rangos. La clave nunca vuelve al navegador.
const RangosModel = require("../models/RangosModel");
const UsuarioModel = require("../models/UsuarioModel");

class RangosController {
  static listar = async (req, res, next) => {
    try { res.json(await RangosModel.listar()); }
    catch (error) { next(error); }
  };

  // Las cuentas que existen, para elegir a quién darle un rango (en vez de escribir el nick)
  static usuarios = async (req, res) => {
    try { res.json({ ok: true, usuarios: await UsuarioModel.nicksParaElegir(req.query.q) }); }
    catch (error) {
      const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
      res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message });
    }
  };

  static guardar = async (req, res) => {
    try { res.json(await RangosModel.guardar(req.body)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  };
}

module.exports = RangosController;
