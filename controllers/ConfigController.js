// ConfigController — parámetros de juego por sala y comandos apagados.
// Solo validan y responden: la lógica está en ConfigModel. El que cambia algo queda anotado.
const ConfigModel = require("../models/ConfigModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message });
};

class ConfigController {
  static salas = (req, res) => {
    try { res.json({ ok: true, salas: ConfigModel.salas() }); }
    catch (error) { responder(res, error); }
  };

  static parametros = async (req, res) => {
    try { res.json({ ok: true, ...(await ConfigModel.deSala(req.params.sala)) }); }
    catch (error) { responder(res, error); }
  };

  static guardarParametro = async (req, res) => {
    try {
      const { valor } = req.body || {};
      res.json({ ok: true, ...(await ConfigModel.guardar(req.params.sala, req.params.nombre, valor, req.usuario.nick)) });
    } catch (error) { responder(res, error); }
  };

  static restablecerParametro = async (req, res) => {
    try { res.json({ ok: true, ...(await ConfigModel.restablecer(req.params.sala, req.params.nombre)) }); }
    catch (error) { responder(res, error); }
  };

  static comandos = async (req, res) => {
    try { res.json({ ok: true, ...(await ConfigModel.comandos(req.params.sala)) }); }
    catch (error) { responder(res, error); }
  };

  static cambiarComando = async (req, res) => {
    try {
      const { comando, activo, todas } = req.body || {};
      const sala = todas ? ConfigModel.TODAS : req.params.sala;
      res.json({ ok: true, ...(await ConfigModel.cambiarComando(sala, comando, Boolean(activo), req.usuario.nick)) });
    } catch (error) { responder(res, error); }
  };
}

module.exports = ConfigController;
