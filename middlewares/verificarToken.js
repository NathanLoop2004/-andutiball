// Deja pasar solo al que tiene sesión. Con { admin: true } además le pide rango de admin.
//
//   app.use("/api/algo", verificarToken(), Controller.algo);
//   app.use("/api/otro", verificarToken({ admin: true }), Controller.otro);
//
// Con { opcional: true } NO corta a nadie: si hay sesión deja el usuario en req.usuario y si
// no, sigue igual. Sirve para las páginas públicas que muestran algo más cuando estás
// adentro (por ejemplo, si esa camiseta la tenés en favoritos).
const SesionModel = require("../models/SesionModel");

const verificarToken = ({ admin = false, opcional = false } = {}) => (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);

  if (!datos) {
    if (opcional) return next();
    return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });
  }
  if (admin && !datos.admin) return res.status(403).json({ ok: false, error: "Esto es solo para los admins" });
  req.usuario = datos;
  next();
};

module.exports = verificarToken;
