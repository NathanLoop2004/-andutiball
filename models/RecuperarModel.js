// =============================================================================
// RecuperarModel — "me olvidé la contraseña".
//
//   1. pedir({ email })   → si hay una cuenta con ese correo, le manda un mail con un link
//                           /frm/recuperar/?t=<token>. SIEMPRE contesta lo mismo, exista o no,
//                           así nadie puede averiguar qué correos están registrados.
//   2. revisar(token)     → la pantalla pregunta si el link sirve (y de quién es) antes de
//                           mostrar el formulario.
//   3. cambiar({ token, clave }) → pone la clave nueva y el link deja de servir.
//
// El token es de 32 bytes al azar. En la base se guarda solo su SHA-256 (recuperarHash): si
// alguien se lleva la base, no tiene links que funcionen. Vence a los MINUTOS_LINK y se
// borra apenas se usa.
// =============================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { base } = require("../services/ConexionBase");
const claves = require("../lib/claves");
const Correo = require("../services/Correo");
const { limpiarEmail } = require("./UsuarioModel");

const MINUTOS_LINK = 30;
const ARCHIVO_TUNEL = process.env.TUNEL_FILE || path.join(__dirname, "..", "datos", "tunel.json");

const hashDe = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

// De dónde sale el link del mail. NO se usa el Host del pedido: cualquiera podría mandar un
// Host falso y hacer que el mail apunte a su página. Orden: WEB_URL (.env) → el túnel abierto
// → localhost.
function direccionDeLaWeb() {
  const puesta = (process.env.WEB_URL || "").trim();
  if (puesta) return puesta.replace(/\/+$/, "");
  try {
    const tunel = JSON.parse(fs.readFileSync(ARCHIVO_TUNEL, "utf8"));
    if (tunel && tunel.url && tunel.estado !== "abajo") return String(tunel.url).replace(/\/+$/, "");
  } catch (error) {}
  return "http://localhost:" + (process.env.PANEL_PORT || 8080);
}

const MENSAJE_PEDIDO = "Si hay una cuenta con ese correo, te mandamos un link para cambiar la contraseña. Revisá también el spam.";

class RecuperarModel {
  static MINUTOS_LINK = MINUTOS_LINK;
  static direccionDeLaWeb = direccionDeLaWeb;

  static async pedir({ email }) {
    const correo = limpiarEmail(email);
    if (!correo) throw new Error("Escribí tu correo electrónico");

    const usuario = await base().usuario.findUnique({ where: { email: correo } });
    if (!usuario || usuario.baneado) return { mensaje: MENSAJE_PEDIDO };

    const token = crypto.randomBytes(32).toString("base64url");
    await base().usuario.update({
      where: { id: usuario.id },
      data: { recuperarHash: hashDe(token), recuperarVence: new Date(Date.now() + MINUTOS_LINK * 60 * 1000) },
    });

    const link = direccionDeLaWeb() + "/frm/recuperar/?t=" + encodeURIComponent(token);
    const mail = Correo.mailRecuperar({ nick: usuario.nick, link, minutos: MINUTOS_LINK });
    try {
      await Correo.enviar({ para: correo, ...mail });
    } catch (error) {
      // Se avisa en la consola, pero a la persona se le contesta igual (no se filtra nada)
      console.error("⚠️ No se pudo mandar el mail de recuperación a " + usuario.nick + ": " + error.message);
      throw new Error("No se pudo mandar el correo ahora. Probá de nuevo en un rato.");
    }
    return { mensaje: MENSAJE_PEDIDO };
  }

  // El usuario dueño del link, si todavía sirve. null si no.
  static async deToken(token) {
    if (!token || String(token).length < 20) return null;
    const usuario = await base().usuario.findUnique({ where: { recuperarHash: hashDe(token) } });
    if (!usuario || !usuario.recuperarVence || usuario.recuperarVence.getTime() < Date.now()) return null;
    return usuario;
  }

  static async revisar(token) {
    const usuario = await RecuperarModel.deToken(token);
    if (!usuario) throw new Error("El link venció o ya se usó. Pedí uno nuevo.");
    return { nick: usuario.nick };
  }

  static async cambiar({ token, clave }) {
    const usuario = await RecuperarModel.deToken(token);
    if (!usuario) throw new Error("El link venció o ya se usó. Pedí uno nuevo.");
    claves.revisarClave(clave);
    await base().usuario.update({
      where: { id: usuario.id },
      data: { clave: claves.hashear(clave), claveCambiada: new Date(), recuperarHash: null, recuperarVence: null },
    });
    return { nick: usuario.nick };
  }
}

module.exports = RecuperarModel;
