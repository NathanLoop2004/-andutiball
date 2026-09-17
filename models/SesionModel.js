// =============================================================================
// SesionModel — entrar a Ñandutí Web con el mismo usuario y la misma clave de la sala.
//
// El que se registró en HaxBall con !registrar entra acá con eso mismo: es la tabla
// `usuarios`. Y al revés: el que se crea la cuenta en la web, después entra a la sala con
// !clave y su contraseña.
//
// El rango (OWNER, CO-OWNER, …) sale de roles.json, que es donde vive hoy: el que tiene un
// rango con admin ve el panel.
// =============================================================================
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const UsuarioModel = require("./UsuarioModel");
const RangoModel = require("./RangoModel");

// El token dura una hora y media. Mientras la persona esté usando la web se renueva solo
// (la web pregunta por /api/auth/yo), así que va cambiando y nadie se queda afuera de golpe.
const MINUTOS_DE_VIDA = 90;
const MINUTOS_PARA_RENOVAR = 45;   // se cambia por uno nuevo cuando le queda menos que esto

// Sin JWT_SECRET en .env, una clave al vuelo: anda igual, pero las sesiones se caen
// cuando se reinicia el proceso. Se avisa una sola vez.
let secretoAlVuelo = null;
let avisado = false;
function secreto() {
  const puesto = (process.env.JWT_SECRET || "").trim();
  if (puesto) return puesto;
  if (!avisado) {
    avisado = true;
    console.warn("⚠️ Falta JWT_SECRET en .env: las sesiones de la web se caen al reiniciar");
  }
  if (!secretoAlVuelo) secretoAlVuelo = crypto.randomBytes(32).toString("hex");
  return secretoAlVuelo;
}

// El rango sale de la tabla `rangos`; si la base está apagada, de roles.json (el espejo)
async function rangoDe(nick) {
  try {
    return await RangoModel.deNick(nick);
  } catch (error) {
    return null;
  }
}

// El OWNER es el único que ve la pantalla de usuarios
// Se compara la palabra del rango, sin emojis (ver lib/permisos.js)
const { esOwner, puedeConfigurar, puedeVerRangos } = require("../lib/permisos");

class SesionModel {
  static esOwner = esOwner;
  static puedeConfigurar = puedeConfigurar;
  static puedeVerRangos = puedeVerRangos;
  static rangoDe = rangoDe;

  // Lo que se le manda al navegador: nunca el hash de la clave
  static async fichaDe(usuario) {
    const rango = await rangoDe(usuario.nick);
    return {
      nick: usuario.nick,
      elo: usuario.elo,
      partidos: usuario.partidos,
      ganados: usuario.ganados,
      goles: usuario.goles,
      asistencias: usuario.asistencias,
      desde: usuario.creado,
      rango: rango ? rango.nombre : null,
      admin: rango ? rango.admin : false,
      owner: esOwner(rango),
      configura: puedeConfigurar(rango),   // puede tocar los parámetros de las salas
      rangos: puedeVerRangos(rango),       // puede ver y cambiar los rangos (OWNER y CO-OWNER)
    };
  }

  static firmar(ficha) {
    return jwt.sign(
      // sid: un número al azar por sesión, para que dos tokens seguidos nunca salgan iguales
      { nick: ficha.nick, rango: ficha.rango, admin: ficha.admin, sid: crypto.randomBytes(8).toString("hex") },
      secreto(),
      { expiresIn: MINUTOS_DE_VIDA * 60 }
    );
  }

  // ¿Ya le queda menos de MINUTOS_PARA_RENOVAR? Entonces le damos uno nuevo
  static hayQueRenovar(datos) {
    if (!datos || !datos.exp) return true;
    return datos.exp * 1000 - Date.now() < MINUTOS_PARA_RENOVAR * 60 * 1000;
  }

  static leerToken(token) {
    try {
      return jwt.verify(String(token || ""), secreto());
    } catch (error) {
      return null;
    }
  }

  static async entrar({ nick, clave }) {
    const verificado = await UsuarioModel.verificar({ nick, clave });
    if (!verificado.ok) {
      throw new Error(verificado.motivo === "sin-usuario" || verificado.motivo === "sin-clave"
        ? "Ese usuario no existe. Creá tu cuenta primero."
        : "Usuario o contraseña incorrectos");
    }
    const usuario = await UsuarioModel.buscarPorNick(nick);
    if (usuario.baneado) throw new Error("Tu cuenta está baneada" + (usuario.motivoBan ? ": " + usuario.motivoBan : ""));
    const ficha = await SesionModel.fichaDe(usuario);
    return { token: SesionModel.firmar(ficha), usuario: ficha };
  }

  // En la web el correo es obligatorio: es lo que permite recuperar la cuenta
  static async registrar({ nick, clave, email }) {
    UsuarioModel.revisarEmail(email);
    await UsuarioModel.registrar({ nick, clave, email });
    const usuario = await UsuarioModel.buscarPorNick(nick);
    const ficha = await SesionModel.fichaDe(usuario);
    return { token: SesionModel.firmar(ficha), usuario: ficha };
  }

  // Los datos frescos del que ya tiene sesión (por si le cambiaron el rango).
  // De paso le renueva el token si está por vencer: { usuario, token }
  static async yo(token) {
    const datos = SesionModel.leerToken(token);
    if (!datos) throw new Error("La sesión venció, volvé a entrar");
    const usuario = await UsuarioModel.buscarPorNick(datos.nick);
    if (!usuario) throw new Error("Ese usuario ya no existe");
    if (usuario.baneado) throw new Error("La sesión se cerró: tu cuenta está baneada");

    const ficha = await SesionModel.fichaDe(usuario);
    return { usuario: ficha, token: SesionModel.hayQueRenovar(datos) ? SesionModel.firmar(ficha) : null };
  }
}

module.exports = SesionModel;
module.exports.rangoDe = rangoDe;
module.exports.MINUTOS_DE_VIDA = MINUTOS_DE_VIDA;
module.exports.MINUTOS_PARA_RENOVAR = MINUTOS_PARA_RENOVAR;
