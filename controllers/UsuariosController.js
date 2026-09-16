// UsuariosController — la pantalla de usuarios del OWNER: buscar, banear y ponerles clave nueva.
// Las claves no se pueden ver: están hasheadas (lib/claves.js). Solo se pueden reemplazar.
const UsuarioModel = require("../models/UsuarioModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  const noExiste = /Record to update not found|No record was found|P2025/i.test(error.message + (error.code || ""));
  const status = sinBase ? 503 : noExiste ? 404 : 400;
  const mensaje = sinBase ? "La base de datos no está levantada" : noExiste ? "Ese usuario no existe" : error.message;
  res.status(status).json({ ok: false, error: mensaje });
};

class UsuariosController {
  static listar = async (req, res) => {
    try {
      const { q, pagina } = req.query;
      res.json({ ok: true, ...(await UsuarioModel.buscar({ q, pagina, porPagina: 15 })) });
    } catch (error) { responder(res, error); }
  };

  static banear = async (req, res) => {
    try {
      if (req.params.nick === req.usuario.nick) throw new Error("No te podés banear a vos mismo");
      const usuario = await UsuarioModel.banear(req.params.nick, (req.body || {}).motivo);
      res.json({ ok: true, usuario });
    } catch (error) { responder(res, error); }
  };

  static desbanear = async (req, res) => {
    try { res.json({ ok: true, usuario: await UsuarioModel.desbanear(req.params.nick) }); }
    catch (error) { responder(res, error); }
  };

  static ponerClave = async (req, res) => {
    try { res.json({ ok: true, usuario: await UsuarioModel.ponerClave(req.params.nick, (req.body || {}).clave) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = UsuariosController;
