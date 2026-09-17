// CuentaController — "Mi cuenta": el que tiene sesión ve sus datos y cambia su contraseña
// con un código que le llega al correo. El nick sale del token (verificarToken), nunca del pedido.
const CuentaModel = require("../models/CuentaModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  const sinCuenta = /ya no existe|baneada/i.test(error.message);
  res.status(sinBase ? 503 : sinCuenta ? 401 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : error.message,
  });
};

class CuentaController {
  static ficha = async (req, res) => {
    try { res.json({ ok: true, cuenta: await CuentaModel.ficha(req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };

  static pedirCodigo = async (req, res) => {
    try { res.json({ ok: true, ...(await CuentaModel.pedirCodigo(req.usuario.nick)) }); }
    catch (error) { responder(res, error); }
  };

  static cambiarClave = async (req, res) => {
    try {
      const { codigo, clave } = req.body || {};
      res.json(await CuentaModel.cambiarClave(req.usuario.nick, { codigo, clave }));
    } catch (error) { responder(res, error); }
  };

  static ponerEmail = async (req, res) => {
    try {
      const { email, clave } = req.body || {};
      res.json({ ok: true, ...(await CuentaModel.ponerEmail(req.usuario.nick, { email, clave })) });
    } catch (error) { responder(res, error); }
  };
}

module.exports = CuentaController;
