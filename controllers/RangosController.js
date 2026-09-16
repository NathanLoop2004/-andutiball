// RangosController — leer y guardar los rangos. La clave nunca vuelve al navegador.
const RangosModel = require("../models/RangosModel");

class RangosController {
  static listar = async (req, res, next) => {
    try { res.json(await RangosModel.listar()); }
    catch (error) { next(error); }
  };

  static guardar = async (req, res) => {
    try { res.json(await RangosModel.guardar(req.body)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  };
}

module.exports = RangosController;
