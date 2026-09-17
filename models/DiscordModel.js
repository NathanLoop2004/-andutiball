// =============================================================================
// DiscordModel — vincular la cuenta de Discord (desde "Mi cuenta") y meterlo al servidor.
//
//   1. iniciar(nick)          el que ya tiene sesión toca "Vincular con Discord": se arma un
//                             "state" al azar (se guarda su hash, vence en 10 min) y se lo manda
//                             a Discord a autorizar.
//   2. vuelta({code, state})  Discord vuelve a /api/discord/vuelta. El state dice de qué cuenta
//                             es (la vuelta no trae el token de la web), sirve UNA vez y vence.
//                             Se canjea el código, se guarda quién es y se lo mete al servidor.
//   3. desvincular(nick)
//
// Un mismo Discord no puede quedar en dos cuentas.
// =============================================================================
const crypto = require("crypto");
const { base } = require("../services/ConexionBase");
const Discord = require("../services/Discord");
const RecuperarModel = require("./RecuperarModel");

const MINUTOS_ESTADO = 10;
const hash = (t) => crypto.createHash("sha256").update(String(t || "")).digest("hex");

// Dónde vuelve Discord. Tiene que estar registrada tal cual en el portal de Discord.
// Con DISCORD_REDIRECT_URI apuntando a la página puente (GitHub Pages), no cambia nunca aunque
// cambie el link de la web: el puente reenvía al link que viaja en el state.
function direccionDeVuelta() {
  const puesta = (process.env.DISCORD_REDIRECT_URI || "").trim();
  return puesta || RecuperarModel.direccionDeLaWeb() + "/api/discord/vuelta";
}

async function usuarioConSesion(nick) {
  const u = await base().usuario.findUnique({ where: { nick: String(nick || "").trim() } });
  if (!u || !u.clave) throw new Error("Ese usuario ya no existe");
  if (u.baneado) throw new Error("Tu cuenta está baneada");
  return u;
}

class DiscordModel {
  static direccionDeVuelta = direccionDeVuelta;

  static disponible() {
    return Discord.faltaConfigurar().length === 0;
  }

  static async iniciar(nick) {
    const u = await usuarioConSesion(nick);
    const faltan = Discord.faltaConfigurar();
    if (faltan.length) {
      console.warn("⚠️ Discord sin configurar: faltan " + faltan.join(", ") + " en .env");
      throw new Error("El vínculo con Discord todavía no está configurado. Avisale a un administrador.");
    }
    // "<al azar>.<link actual de la web>": si Discord vuelve a la página puente (dirección fija en
    // GitHub Pages), el puente lee el link de la web de acá y reenvía. Ver puente-discord/.
    const web = Buffer.from(RecuperarModel.direccionDeLaWeb()).toString("base64url");
    const state = crypto.randomBytes(32).toString("base64url") + "." + web;
    const vuelta = direccionDeVuelta();
    await base().usuario.update({
      where: { id: u.id },
      data: { discordEstadoHash: hash(state), discordEstadoVence: new Date(Date.now() + MINUTOS_ESTADO * 60 * 1000), discordVuelta: vuelta },
    });
    return { url: Discord.urlParaAutorizar({ state, redirectUri: vuelta }) };
  }

  // Devuelve { resultado } para mostrar en Mi cuenta:
  //   vinculado · ya-estaba · sin-servidor · cancelado · vencido · otra-cuenta · error
  static async vuelta({ code, state, error }) {
    if (!state || String(state).length < 20) return { resultado: "vencido" };
    const u = await base().usuario.findUnique({ where: { discordEstadoHash: hash(state) } });
    if (!u) return { resultado: "vencido" };

    // El state sirve una sola vez, pase lo que pase
    const vuelta = u.discordVuelta;
    const vence = u.discordEstadoVence;
    await base().usuario.update({ where: { id: u.id }, data: { discordEstadoHash: null, discordEstadoVence: null, discordVuelta: null } });

    if (!vence || vence.getTime() < Date.now()) return { resultado: "vencido" };
    if (error || !code) return { resultado: "cancelado" };

    let accessToken;
    let puedeUnirse;
    let perfil;
    try {
      ({ accessToken, puedeUnirse } = await Discord.canjearCodigo({ code, redirectUri: vuelta }));
      perfil = await Discord.quienSoy(accessToken);
    } catch (e) {
      console.warn("⚠️ Discord: no se pudo vincular a " + u.nick + ": " + e.message);
      return { resultado: "error" };
    }

    const otro = await base().usuario.findUnique({ where: { discordId: perfil.id } });
    if (otro && otro.id !== u.id) return { resultado: "otra-cuenta" };

    await base().usuario.update({
      where: { id: u.id },
      data: { discordId: perfil.id, discordUsuario: perfil.usuario, discordAvatar: perfil.avatar, discordVinculado: new Date() },
    });

    if (!puedeUnirse) return { resultado: "sin-servidor" };
    try {
      const r = await Discord.meterAlServidor({ discordId: perfil.id, accessToken });
      return { resultado: r === "ya-estaba" ? "ya-estaba" : "vinculado" };
    } catch (e) {
      console.warn("⚠️ Discord: " + u.nick + " quedó vinculado pero no se lo pudo agregar al servidor: " + e.message);
      return { resultado: "sin-servidor" };
    }
  }

  static async desvincular(nick) {
    const u = await usuarioConSesion(nick);
    await base().usuario.update({ where: { id: u.id }, data: { discordId: null, discordUsuario: null, discordAvatar: null, discordVinculado: null } });
    return { ok: true };
  }
}

module.exports = DiscordModel;
