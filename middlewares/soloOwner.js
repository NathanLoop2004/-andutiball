// Deja pasar solo al OWNER. Pide sesión (token) y además vuelve a mirar el rango en la tabla
// en cada pedido: si le sacaron el OWNER, el token viejo ya no le sirve.
//
//   router.get("/usuarios", soloOwner, UsuariosController.listar);
const SesionModel = require("../models/SesionModel");

const soloOwner = async (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);
  if (!datos) return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });

  const rango = await SesionModel.rangoDe(datos.nick);
  if (!SesionModel.esOwner(rango)) return res.status(403).json({ ok: false, error: "Esto es solo para el OWNER" });

  req.usuario = datos;
  next();
};

module.exports = soloOwner;
