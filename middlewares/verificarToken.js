// Deja pasar solo al que tiene sesión. Con { admin: true } además le pide rango de admin.
//
//   app.use("/api/algo", verificarToken(), Controller.algo);
//   app.use("/api/otro", verificarToken({ admin: true }), Controller.otro);
const SesionModel = require("../models/SesionModel");

const verificarToken = ({ admin = false } = {}) => (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);
  if (!datos) return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });
  if (admin && !datos.admin) return res.status(403).json({ ok: false, error: "Esto es solo para los admins" });
  req.usuario = datos;
  next();
};

module.exports = verificarToken;
