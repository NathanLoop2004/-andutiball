// Deja pasar a los rangos que pueden tocar la configuración de las salas:
// OWNER, CO-OWNER, HOSTER y AYUDANTE (ver lib/permisos.js).
//
// Pide sesión (token) y vuelve a mirar el rango en la tabla en cada pedido: si le sacaron el
// rango, el token viejo ya no le sirve.
const SesionModel = require("../models/SesionModel");

const puedeConfigurar = async (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);
  if (!datos) return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });

  const rango = await SesionModel.rangoDe(datos.nick);
  if (!SesionModel.puedeConfigurar(rango)) {
    return res.status(403).json({ ok: false, error: "Esto es solo para OWNER, CO-OWNER, HOSTER y AYUDANTE" });
  }

  req.usuario = { ...datos, rango: rango.nombre };
  next();
};

module.exports = puedeConfigurar;
