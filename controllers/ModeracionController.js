// ModeracionController — kick y ban desde el panel.
// La clave de sala es opcional: /api/kick en la sala, /api/kick/3v3 desde el panel.
const ModeracionModel = require("../models/ModeracionModel");

class ModeracionController {
  static _ctx = (req) => req.app.locals;

  static expulsar = (banear) => async (req, res, next) => {
    try {
      const { id, motivo } = req.body || {};
      const { status, ...resto } = await ModeracionModel.expulsar(ModeracionController._ctx(req), {
        claveSala: req.params.sala,
        id,
        motivo,
        banear,
      });
      res.status(status).json(resto);
    } catch (error) { next(error); }
  };

  static kick = ModeracionController.expulsar(false);
  static ban = ModeracionController.expulsar(true);
}

module.exports = ModeracionController;
