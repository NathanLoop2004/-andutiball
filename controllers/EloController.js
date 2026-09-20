// EloController — la tabla de puntajes y las divisiones.
const EloModel = require("../models/EloModel");
const RachasModel = require("../models/RachasModel");

class EloController {
  static ranking = (req, res, next) => {
    try { res.json(EloModel.rankingPublico(req.query.limite, req.query.sala)); }
    catch (error) { res.status(400).json({ ok: false, error: error.message }); }
  };

  static tabla = (req, res, next) => {
    try { res.json(EloModel.tabla(req.query.limite)); }
    catch (error) { next(error); }
  };

  // Las mejores rachas de la historia y las que están vivas ahora. Lo ve cualquiera.
  static rachas = async (req, res) => {
    try {
      const [mejores, enCurso] = await Promise.all([
        RachasModel.mejores(req.query.limite || 10),
        RachasModel.enCurso(5),
      ]);
      res.json({ ok: true, mejores, enCurso });
    } catch (error) {
      const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
      if (sinBase) return res.json({ ok: true, mejores: [], enCurso: [] });
      res.status(400).json({ ok: false, error: error.message });
    }
  };
}

module.exports = EloController;
