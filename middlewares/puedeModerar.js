// Deja pasar a los que pueden moderar desde el panel:
//
//   puedeModerar()                 expulsar (kick): OWNER, CO-OWNER, HOSTER y AYUDANTE
//   puedeModerar({ banear: true }) banear:          OWNER, CO-OWNER y HOSTER (el AYUDANTE no)
//
// Pide sesión (token) y vuelve a mirar el rango en la tabla en cada pedido. El panel reenvía el
// mismo Authorization a la sala (ModeracionModel.reenviar), así la sala lo vuelve a revisar.
const SesionModel = require("../models/SesionModel");
const { puedeExpulsar, puedeBanear } = require("../lib/permisos");

const puedeModerar = ({ banear = false } = {}) => async (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const datos = SesionModel.leerToken(token);
  if (!datos) return res.status(401).json({ ok: false, error: "Necesitás iniciar sesión" });

  const rango = await SesionModel.rangoDe(datos.nick);
  const puede = banear ? puedeBanear(rango) : puedeExpulsar(rango);
  if (!puede) {
    console.warn(`⚠️ Moderación: ${datos.nick} (${rango ? rango.nombre : "sin rango"}) quiso ${banear ? "banear" : "expulsar"} y no puede`);
    return res.status(403).json({
      ok: false,
      error: banear ? "Los AYUDANTES no pueden banear: solo expulsar" : "Esto es solo para los rangos que moderan",
    });
  }
  req.usuario = { ...datos, rango: rango ? rango.nombre : null };
  next();
};

module.exports = puedeModerar;
