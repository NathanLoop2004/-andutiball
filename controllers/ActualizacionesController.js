// ActualizacionesController — las novedades que se le cuentan a la gente en el Discord.
// Guardar y enviar son dos pasos distintos a propósito: nada sale sin que se lo haya leído.
const ActualizacionModel = require("../models/ActualizacionModel");
const WebhookActualizaciones = require("../services/WebhookActualizaciones");

// La base es opcional en este proyecto: si está apagada, se avisa sin drama
const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: error.message, sinBase });
};

class ActualizacionesController {
  static listar = async (req, res) => {
    try {
      res.json({
        hayWebhook: WebhookActualizaciones.hayWebhook(),
        actualizaciones: await ActualizacionModel.listar({ estado: req.query.estado }),
      });
    } catch (error) { responder(res, error); }
  };

  static crear = async (req, res) => {
    try {
      const { titulo, mensaje, origen, commit } = req.body || {};
      res.status(201).json({ ok: true, actualizacion: await ActualizacionModel.crear({ titulo, mensaje, origen, commit }) });
    } catch (error) { responder(res, error); }
  };

  static enviar = async (req, res) => {
    try {
      res.json({ ok: true, actualizacion: await ActualizacionModel.enviar(req.params.id) });
    } catch (error) { responder(res, error); }
  };

  static enviarPendientes = async (req, res) => {
    try {
      res.json({ ok: true, ...(await ActualizacionModel.enviarPendientes()) });
    } catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try {
      await ActualizacionModel.borrar(req.params.id);
      res.json({ ok: true });
    } catch (error) { responder(res, error); }
  };
}

module.exports = ActualizacionesController;
