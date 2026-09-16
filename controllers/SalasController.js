// SalasController — la lista de salas con su estado (la local o las cuatro).
const SalasModel = require("../models/SalasModel");

class SalasController {
  static _ctx = (req) => req.app.locals;

  static listar = async (req, res, next) => {
    try { res.json({ salas: await SalasModel.listar(SalasController._ctx(req)) }); }
    catch (error) { next(error); }
  };
}

module.exports = SalasController;
