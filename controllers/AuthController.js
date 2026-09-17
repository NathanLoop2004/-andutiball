// AuthController — entrar y registrarse en Ñandutí Web.
// Es el mismo usuario y la misma clave que se usan en la sala (tabla `usuarios`).
const SesionModel = require("../models/SesionModel");
const RecuperarModel = require("../models/RecuperarModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({ ok: false, error: sinBase ? "La base de datos no está levantada" : error.message, sinBase });
};

const tokenDe = (req) => String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");

class AuthController {
  static entrar = async (req, res) => {
    try {
      const { nick, clave } = req.body || {};
      res.json({ ok: true, ...(await SesionModel.entrar({ nick, clave })) });
    } catch (error) { responder(res, error); }
  };

  static registrar = async (req, res) => {
    try {
      const { nick, clave, email } = req.body || {};
      res.status(201).json({ ok: true, ...(await SesionModel.registrar({ nick, clave, email })) });
    } catch (error) { responder(res, error); }
  };

  // ── Recuperar la cuenta ──
  // Manda el mail con el link. Contesta lo mismo exista o no el correo.
  static recuperar = async (req, res) => {
    try {
      res.json({ ok: true, ...(await RecuperarModel.pedir({ email: (req.body || {}).email })) });
    } catch (error) { responder(res, error); }
  };

  // ¿El link del mail sirve todavía? Devuelve de quién es
  static revisarLink = async (req, res) => {
    try {
      res.json({ ok: true, ...(await RecuperarModel.revisar(req.query.t)) });
    } catch (error) { responder(res, error); }
  };

  static cambiarConLink = async (req, res) => {
    try {
      const { token, clave } = req.body || {};
      res.json({ ok: true, ...(await RecuperarModel.cambiar({ token, clave })) });
    } catch (error) { responder(res, error); }
  };

  // Devuelve quién sos y, si el token está por vencer, uno nuevo (la web lo guarda)
  static yo = async (req, res) => {
    try {
      const { usuario, token } = await SesionModel.yo(tokenDe(req));
      res.json({ ok: true, usuario, token });
    } catch (error) { res.status(401).json({ ok: false, error: error.message }); }
  };
}

module.exports = AuthController;
