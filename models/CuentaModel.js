// =============================================================================
// CuentaModel — "Mi cuenta": lo que ve y cambia el que YA tiene sesión en la web.
//
//   ficha(nick)                    sus datos, su correo y su ELO (sale de elo.json)
//   pedirCodigo(nick)              manda al correo un código de 6 números
//   cambiarClave(nick, {codigo, clave})   con el código correcto, pone la clave nueva
//   ponerEmail(nick, {email, clave})      para los que se registraron antes de pedir correo
//
// El código:
//   · se guarda SOLO su hash (con el id del usuario adentro, así no sirve para otro);
//   · vence a los MINUTOS_CODIGO y se borra apenas se usa;
//   · se permiten INTENTOS_MAXIMOS errores: después hay que pedir otro;
//   · no se puede pedir otro hasta pasados SEGUNDOS_ENTRE_CODIGOS (para no llenar la bandeja).
// =============================================================================
const crypto = require("crypto");
const { base } = require("../services/ConexionBase");
const claves = require("../lib/claves");
const Correo = require("../services/Correo");
const Correos = require("../lib/correos");
const EloModel = require("./EloModel");
const DiscordModel = require("./DiscordModel");
const MonedasModel = require("./MonedasModel");
const { revisarEmail } = require("./UsuarioModel");

const MINUTOS_CODIGO = 10;
const INTENTOS_MAXIMOS = 5;
const SEGUNDOS_ENTRE_CODIGOS = 60;

const hashDelCodigo = (usuarioId, codigo) =>
  crypto.createHash("sha256").update(usuarioId + ":" + String(codigo).trim()).digest("hex");

const iguales = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// "juanperez@gmail.com" → "ju•••••••@gmail.com" (para mostrar a dónde se mandó el código)
function taparEmail(email) {
  if (!email) return null;
  const [nombre, dominio] = String(email).split("@");
  const visible = nombre.slice(0, Math.min(2, nombre.length));
  return visible + "•".repeat(Math.max(3, nombre.length - visible.length)) + "@" + dominio;
}

async function usuarioConSesion(nick) {
  const usuario = await base().usuario.findUnique({ where: { nick: String(nick || "").trim() } });
  if (!usuario || !usuario.clave) throw new Error("Ese usuario ya no existe");
  if (usuario.baneado) throw new Error("Tu cuenta está baneada");
  return usuario;
}

class CuentaModel {
  static MINUTOS_CODIGO = MINUTOS_CODIGO;
  static INTENTOS_MAXIMOS = INTENTOS_MAXIMOS;
  static taparEmail = taparEmail;

  static async ficha(nick) {
    const u = await usuarioConSesion(nick);
    return {
      nick: u.nick,
      email: u.email,
      emailTapado: taparEmail(u.email),
      desde: u.creado,
      claveCambiada: u.claveCambiada,
      elo: EloModel.deNick(u.nick),          // el general
      eloPorSala: EloModel.porSala(u.nick),  // [{ sala, nombre, elo }]
      ...(await MonedasModel.fichaDe(u.nick)),   // monedas, ganadas, gastadas, historial
      discord: u.discordId ? { usuario: u.discordUsuario, avatar: u.discordAvatar, vinculado: u.discordVinculado } : null,
      discordDisponible: DiscordModel.disponible(),
    };
  }

  static async pedirCodigo(nick) {
    const u = await usuarioConSesion(nick);
    if (!u.email) throw new Error("Tu cuenta no tiene correo. Agregalo primero para poder recibir el código.");

    if (u.codigoPedido) {
      const faltan = Math.ceil(SEGUNDOS_ENTRE_CODIGOS - (Date.now() - u.codigoPedido.getTime()) / 1000);
      if (faltan > 0) throw new Error(`Esperá ${faltan} segundos para pedir otro código.`);
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await base().usuario.update({
      where: { id: u.id },
      data: {
        codigoHash: hashDelCodigo(u.id, codigo),
        codigoVence: new Date(Date.now() + MINUTOS_CODIGO * 60 * 1000),
        codigoIntentos: 0,
        codigoPedido: new Date(),
      },
    });

    try {
      await Correo.enviar({ para: u.email, ...Correo.mailCodigo({ nick: u.nick, codigo, minutos: MINUTOS_CODIGO }) });
    } catch (error) {
      console.error("⚠️ No se pudo mandar el código a " + u.nick + ": " + error.message);
      // Si no salió, que pueda pedir otro al toque
      await base().usuario.update({ where: { id: u.id }, data: { codigoHash: null, codigoVence: null, codigoPedido: null } });
      throw new Error("No se pudo mandar el correo ahora. Probá de nuevo en un rato.");
    }
    return { enviadoA: taparEmail(u.email), minutos: MINUTOS_CODIGO };
  }

  static async cambiarClave(nick, { codigo, clave }) {
    const u = await usuarioConSesion(nick);
    const limpio = String(codigo || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(limpio)) throw new Error("El código son 6 números.");
    if (!u.codigoHash || !u.codigoVence) throw new Error("Primero pedí un código.");
    if (u.codigoVence.getTime() < Date.now()) throw new Error("El código venció. Pedí otro.");
    if (u.codigoIntentos >= INTENTOS_MAXIMOS) throw new Error("Te equivocaste muchas veces. Pedí otro código.");

    if (!iguales(hashDelCodigo(u.id, limpio), u.codigoHash)) {
      const intentos = u.codigoIntentos + 1;
      await base().usuario.update({ where: { id: u.id }, data: { codigoIntentos: intentos } });
      const quedan = INTENTOS_MAXIMOS - intentos;
      throw new Error(quedan > 0 ? `Código incorrecto. Te quedan ${quedan} ${quedan === 1 ? "intento" : "intentos"}.` : "Código incorrecto. Pedí otro código.");
    }

    claves.revisarClave(clave);
    await base().usuario.update({
      where: { id: u.id },
      data: {
        clave: claves.hashear(clave),
        claveCambiada: new Date(),
        codigoHash: null,
        codigoVence: null,
        codigoIntentos: 0,
        // Si había un link de recuperación dando vueltas, deja de servir
        recuperarHash: null,
        recuperarVence: null,
      },
    });
    return { ok: true };
  }

  // Para los que no tienen correo: se confirma con la contraseña actual
  static async ponerEmail(nick, { email, clave }) {
    const u = await usuarioConSesion(nick);
    if (!claves.verificar(String(clave || ""), u.clave)) throw new Error("La contraseña actual no es esa.");
    const correo = await Correos.revisarQueExista(revisarEmail(email));
    const otro = await base().usuario.findUnique({ where: { email: correo } });
    if (otro && otro.id !== u.id) throw new Error("Ese correo ya lo usa otra cuenta.");
    await base().usuario.update({ where: { id: u.id }, data: { email: correo } });
    return { email: correo, emailTapado: taparEmail(correo) };
  }
}

module.exports = CuentaModel;
