// EloController — la tabla de puntajes y las divisiones.
const EloModel = require("../models/EloModel");

class EloController {
  static ranking = (req, res, next) => {
    try { res.json(EloModel.rankingPublico(req.query.limite)); }
    catch (error) { next(error); }
  };

  static tabla = (req, res, next) => {
    try { res.json(EloModel.tabla(req.query.limite)); }
    catch (error) { next(error); }
  };
}

module.exports = EloController;
