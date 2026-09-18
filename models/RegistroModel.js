// =============================================================================
// RegistroModel — crear la cuenta en dos pasos, para que el correo sea real.
//
//   pedirCodigo({nick, email, clave})          revisa todo, mira que el correo pueda existir
//                                              (lib/correos.js) y le manda un código de 6 números
//   confirmar({nick, email, clave, codigo})    con el código bien, crea la cuenta
//
// Si el correo no existe, el código nunca llega y la cuenta no se crea.
//
// El OWNER puede apagar cada control desde el panel (Ajustes → Crear cuenta): el código por
// correo, la revisión de que el correo exista, pedir correo, o el registro entero.
//
// Lo pendiente vive en memoria (se pierde si se reinicia la web: se pide otro código). Se guarda
// solo el hash del código, atado al correo y al nick, así no sirve para otra cuenta. La contraseña
// no se guarda: el navegador la vuelve a mandar al confirmar.
// =============================================================================
const crypto = require("crypto");
const { base } = require("../services/ConexionBase");
const claves = require("../lib/claves");
const Correos = require("../lib/correos");
const Correo = require("../services/Correo");
const UsuarioModel = require("./UsuarioModel");
const AjustesModel = require("./AjustesModel");

const MINUTOS_CODIGO = 10;
const INTENTOS_MAXIMOS = 5;
const SEGUNDOS_ENTRE_CODIGOS = 60;

const pendientes = new Map();   // correo → { hash, vence, intentos, pedido }

const hashDe = (email, nick, codigo) =>
  crypto.createHash("sha256").update(`${email}:${String(nick).toLowerCase()}:${String(codigo).trim()}`).digest("hex");

const iguales = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ¿El correo no salió por culpa NUESTRA? (la clave del SMTP, la conexión), no de la dirección
const esProblemaNuestro = (error) =>
  /invalid login|535|534|EAUTH|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|self.signed|certificate|SMTP sin configurar/i.test(String(error && error.message));

function limpiarVencidos() {
  const ahora = Date.now();
  for (const [correo, p] of pendientes) if (p.vence < ahora) pendientes.delete(correo);
}

// Lo que tiene que estar bien antes de mandar el código (y otra vez al confirmar).
// Lo que se pide depende de los ajustes que maneja el OWNER (AjustesModel).
async function revisarDatos({ nick, email, clave }) {
  const ajustes = await AjustesModel.valores();
  if (!ajustes.permitirRegistro) throw new Error("Por ahora no se pueden crear cuentas nuevas. Probá más tarde.");

  const nombre = String(nick == null ? "" : nick).trim();
  if (!nombre) throw new Error("Falta el nombre");
  claves.revisarClave(clave);

  let correo = null;
  if (ajustes.pedirCorreo || String(email || "").trim()) {
    correo = ajustes.revisarQueExistaElCorreo
      ? await Correos.revisarQueExista(email)
      : UsuarioModel.revisarEmail(email);
  }

  const existente = await UsuarioModel.buscarPorNick(nombre);
  if (existente && existente.clave) throw new Error("Ese nombre ya tiene clave");
  if (correo) {
    const conEseCorreo = await base().usuario.findUnique({ where: { email: correo } });
    if (conEseCorreo && conEseCorreo.nick !== nombre) throw new Error("Ese correo ya lo usa otra cuenta");
  }
  return { nombre, correo, ajustes };
}

class RegistroModel {
  static async pedirCodigo({ nick, email, clave }) {
    limpiarVencidos();
    const { nombre, correo, ajustes } = await revisarDatos({ nick, email, clave });
    if (!ajustes.pedirCodigoDeCorreo) throw new Error("Ahora mismo la cuenta se crea sin código: probá de nuevo.");
    if (!correo) throw new Error("Falta el correo electrónico");

    const anterior = pendientes.get(correo);
    if (anterior) {
      const faltan = Math.ceil(SEGUNDOS_ENTRE_CODIGOS - (Date.now() - anterior.pedido) / 1000);
      if (faltan > 0) throw new Error(`Esperá ${faltan} segundos para pedir otro código.`);
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    pendientes.set(correo, { hash: hashDe(correo, nombre, codigo), vence: Date.now() + MINUTOS_CODIGO * 60 * 1000, intentos: 0, pedido: Date.now() });
    try {
      await Correo.enviar({ para: correo, ...Correo.mailCodigo({ nick: nombre, codigo, minutos: MINUTOS_CODIGO, para: "crear tu cuenta" }) });
    } catch (error) {
      pendientes.delete(correo);
      console.error("⚠️ No se pudo mandar el código de registro a " + nombre + ": " + error.message);
      // Distinguir "el problema es nuestro" de "ese correo no existe": si el servidor de correo
      // nos rechaza a NOSOTROS, no tiene sentido decirle a la persona que revise su dirección.
      if (esProblemaNuestro(error)) throw new Error("No podemos mandar correos en este momento: es un problema nuestro, no de tu correo. Avisale a un administrador y probá más tarde.");
      throw new Error("No se pudo mandar el correo a esa dirección. Revisá que exista y probá de nuevo.");
    }
    return { enviadoA: correo, minutos: MINUTOS_CODIGO };
  }

  static async confirmar({ nick, email, clave, codigo }) {
    limpiarVencidos();
    const { nombre, correo, ajustes } = await revisarDatos({ nick, email, clave });
    // El OWNER puede apagar el código por correo (por ejemplo, si el correo no anda)
    if (!ajustes.pedirCodigoDeCorreo) {
      if (correo) pendientes.delete(correo);
      return UsuarioModel.registrar({ nick: nombre, clave, email: correo });
    }
    const limpio = String(codigo || "").replace(/\s+/g, "");
    if (!limpio) throw new Error("Falta el código que te mandamos al correo.");
    if (!/^\d{6}$/.test(limpio)) throw new Error("El código son 6 números.");

    const p = pendientes.get(correo);
    if (!p) throw new Error("El código venció o no lo pediste. Pedí otro.");
    if (p.intentos >= INTENTOS_MAXIMOS) throw new Error("Te equivocaste muchas veces. Pedí otro código.");
    if (!iguales(hashDe(correo, nombre, limpio), p.hash)) {
      p.intentos++;
      const quedan = INTENTOS_MAXIMOS - p.intentos;
      throw new Error(quedan > 0 ? `Código incorrecto. Te quedan ${quedan} ${quedan === 1 ? "intento" : "intentos"}.` : "Código incorrecto. Pedí otro código.");
    }

    pendientes.delete(correo);
    return UsuarioModel.registrar({ nick: nombre, clave, email: correo });
  }

  static _pendientes = pendientes;   // para las pruebas
}

module.exports = RegistroModel;
