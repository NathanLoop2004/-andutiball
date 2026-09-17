// Deja pasar solo a OWNER y CO-OWNER: los únicos que ven y cambian los rangos (quién es admin).
// Vuelve a mirar el rango en la tabla en cada pedido, así un token viejo no sirve.
const SesionModel = require("../models/SesionModel");

const puedeVerRangos = async (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);
  if (!datos) return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });

  const rango = await SesionModel.rangoDe(datos.nick);
  if (!SesionModel.puedeVerRangos(rango)) {
    return res.status(403).json({ ok: false, error: "Los rangos son solo para OWNER y CO-OWNER" });
  }

  req.usuario = { ...datos, rango: rango.nombre };
  next();
};

module.exports = puedeVerRangos;
