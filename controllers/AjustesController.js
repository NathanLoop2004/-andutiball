// AjustesController — los ajustes generales de la web. Solo los toca el OWNER.
const AjustesModel = require("../models/AjustesModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message, sinBase });
};

class AjustesController {
  static listar = async (req, res) => {
    try { res.json({ ok: true, ajustes: await AjustesModel.lista() }); }
    catch (error) { responder(res, error); }
  };

  static guardar = async (req, res) => {
    try {
      const { valor } = req.body || {};
      const r = await AjustesModel.guardar(req.params.clave, valor, req.usuario.nick);
      console.log(`🛠️ ${req.usuario.nick} cambió el ajuste ${r.clave} → ${r.valor}`);
      res.json({ ok: true, ...r });
    } catch (error) { responder(res, error); }
  };

  // Lo que necesita saber la pantalla de registro (sin sesión): qué se pide al crear la cuenta
  static publicos = async (_req, res) => {
    try {
      const v = await AjustesModel.valores();
      res.json({ ok: true, pedirCodigoDeCorreo: v.pedirCodigoDeCorreo, pedirCorreo: v.pedirCorreo, permitirRegistro: v.permitirRegistro });
    } catch (error) { responder(res, error); }
  };
}

module.exports = AjustesController;
