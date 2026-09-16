// EstadoController — el estado de la sala local, tal cual lo dibuja el panel.
const EstadoModel = require("../models/EstadoModel");

class EstadoController {
  // El contexto de esta app: la sala local y las salas remotas (ver app.js)
  static _ctx = (req) => req.app.locals;

  static obtener = (req, res, next) => {
    try {
      const estado = EstadoModel.obtener(EstadoController._ctx(req).sala);
      if (!estado) return res.status(404).json({ ok: false, error: "Esta instancia no maneja ninguna sala" });
      res.json(estado);
    } catch (error) { next(error); }
  };
}

module.exports = EstadoController;
