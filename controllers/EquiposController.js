// EquiposController — las camisetas de los clubes y los clásicos. Los edita quien puede configurar.
const EquiposModel = require("../models/EquiposModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message, sinBase });
};

class EquiposController {
  static listar = async (_req, res) => {
    try { res.json({ ok: true, ...(await EquiposModel.listar()) }); }
    catch (error) { responder(res, error); }
  };

  static crear = async (req, res) => {
    try { res.status(201).json({ ok: true, equipo: await EquiposModel.crearEquipo(req.body || {}, req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };

  static guardar = async (req, res) => {
    try { res.json({ ok: true, equipo: await EquiposModel.guardarEquipo(req.params.clave, req.body || {}, req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try { res.json({ ok: true, ...(await EquiposModel.borrarEquipo(req.params.clave)) }); }
    catch (error) { responder(res, error); }
  };

  static guardarClasico = async (req, res) => {
    try { res.json({ ok: true, clasico: await EquiposModel.guardarClasico(req.body || {}, req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };

  static borrarClasico = async (req, res) => {
    try { res.json({ ok: true, ...(await EquiposModel.borrarClasico(req.params.id)) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = EquiposController;
