// EloController — la tabla de puntajes y las divisiones.
const EloModel = require("../models/EloModel");

class EloController {
  static ranking = (req, res, next) => {
    try { res.json(EloModel.rankingPublico(req.query.limite, req.query.sala)); }
    catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  };

  static tabla = (req, res, next) => {
    try { res.json(EloModel.tabla(req.query.limite)); }
    catch (error) { next(error); }
  };
}

module.exports = EloController;
