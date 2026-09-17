// =============================================================================
// UsuarioModel — la tabla `usuarios`: la gente que entra a la sala.
//
// La clave va atada al NOMBRE: si el nick está registrado, para jugar hay que poner la
// clave. El que no está registrado juega igual (ver el bloque 🔐 USUARIOS del script).
//
// La clave se guarda hasheada (lib/claves.js). Acá adentro nunca se devuelve el hash.
// =============================================================================
const { base } = require("../services/ConexionBase");
const claves = require("../lib/claves");

const limpiarNick = (nick) => String(nick == null ? "" : nick).trim();

// El correo se guarda en minúsculas y sin espacios, así "Juan@Gmail.com" y "juan@gmail.com" son el mismo
const limpiarEmail = (email) => String(email == null ? "" : email).trim().toLowerCase();
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function revisarEmail(email) {
  const limpio = limpiarEmail(email);
  if (!limpio) throw new Error("Falta el correo electrónico");
  if (limpio.length > 200 || !EMAIL_VALIDO.test(limpio)) throw new Error("Ese correo no es válido");
  return limpio;
}

// Lo que se puede mostrar de un usuario (sin el hash de la clave)
const sinClave = (usuario) => {
  if (!usuario) return null;
  const { clave, recuperarHash, recuperarVence, codigoHash, codigoVence, codigoIntentos, codigoPedido, discordEstadoHash, discordEstadoVence, discordVuelta, ...resto } = usuario;
  return { ...resto, registrado: Boolean(clave) };
};

class UsuarioModel {
  static async buscarPorNick(nick) {
    const nombre = limpiarNick(nick);
    if (!nombre) return null;
    return base().usuario.findUnique({ where: { nick: nombre } });
  }

  static async ficha(nick) {
    return sinClave(await UsuarioModel.buscarPorNick(nick));
  }

  // Los nicks que tienen clave puesta: son los que hay que pedirle clave al entrar
  static async nicksRegistrados() {
    const usuarios = await base().usuario.findMany({
      where: { NOT: { clave: null } },
      select: { nick: true },
    });
    return usuarios.map((u) => u.nick);
  }

  static async listar({ limite = 200 } = {}) {
    const usuarios = await base().usuario.findMany({
      orderBy: [{ elo: "desc" }],
      take: Math.min(Number(limite) || 200, 500),
    });
    return usuarios.map(sinClave);
  }

  // Crea el usuario con su clave, o le pone clave a uno que ya existía sin ella
  // El email es opcional acá (desde la sala no se pide); la web lo exige en SesionModel.registrar
  static async registrar({ nick, clave, auth = null, email = null }) {
    const nombre = limpiarNick(nick);
    if (!nombre) throw new Error("Falta el nombre");
    claves.revisarClave(clave);
    const correo = email ? revisarEmail(email) : null;
    if (correo) {
      const conEseCorreo = await base().usuario.findUnique({ where: { email: correo } });
      if (conEseCorreo && conEseCorreo.nick !== nombre) throw new Error("Ese correo ya lo usa otra cuenta");
    }

    const existente = await UsuarioModel.buscarPorNick(nombre);
    if (existente && existente.clave) throw new Error("Ese nombre ya tiene clave");

    const datos = { clave: claves.hashear(clave), claveCambiada: new Date() };
    if (auth) datos.auth = auth;
    if (correo) datos.email = correo;

    const usuario = existente
      ? await base().usuario.update({ where: { id: existente.id }, data: datos })
      : await base().usuario.create({ data: { nick: nombre, ...datos } });
    return sinClave(usuario);
  }

  // { ok, motivo } — nunca tira por una clave equivocada
  static async verificar({ nick, clave, auth = null }) {
    const usuario = await UsuarioModel.buscarPorNick(nick);
    if (!usuario) return { ok: false, motivo: "sin-usuario" };
    if (!usuario.clave) return { ok: false, motivo: "sin-clave" };
    if (!claves.verificar(clave, usuario.clave)) return { ok: false, motivo: "clave-mal" };

    // Al entrar bien le anotamos el auth y la última vez que se lo vio
    const datos = { visto: new Date() };
    if (auth && auth !== usuario.auth) datos.auth = auth;
    await base().usuario.update({ where: { id: usuario.id }, data: datos });
    return { ok: true, usuario: sinClave(usuario) };
  }

  static async cambiarClave({ nick, claveVieja, claveNueva }) {
    const verificado = await UsuarioModel.verificar({ nick, clave: claveVieja });
    if (!verificado.ok) throw new Error("La clave actual no es esa");
    claves.revisarClave(claveNueva);
    const usuario = await base().usuario.update({
      where: { nick: limpiarNick(nick) },
      data: { clave: claves.hashear(claveNueva), claveCambiada: new Date() },
    });
    return sinClave(usuario);
  }

  // Para elegir a quién darle un rango: solo cuentas de verdad (con clave) y sin ban.
  // Devuelve los nicks que contienen lo buscado, hasta 20.
  static async nicksParaElegir(q = "") {
    const texto = limpiarNick(q).slice(0, 60);
    const lista = await base().usuario.findMany({
      where: { NOT: { clave: null }, baneado: false, ...(texto ? { nick: { contains: texto, mode: "insensitive" } } : {}) },
      select: { nick: true },
      orderBy: { nick: "asc" },
      take: 20,
    });
    return lista.map((u) => u.nick);
  }

  // ── Pantalla de usuarios (solo OWNER) ──

  // 15 por página, con buscador por nick. Nunca trae el hash de la clave.
  static async buscar({ q = "", pagina = 1, porPagina = 15 } = {}) {
    const texto = limpiarNick(q);
    const tam = Math.min(Math.max(Number.parseInt(porPagina, 10) || 15, 1), 100);
    // Busca por nick o por el usuario de Discord vinculado
    const where = texto
      ? { OR: [{ nick: { contains: texto, mode: "insensitive" } }, { discordUsuario: { contains: texto, mode: "insensitive" } }] }
      : {};
    const total = await base().usuario.count({ where });
    const paginas = Math.max(1, Math.ceil(total / tam));
    const actual = Math.min(Math.max(Number.parseInt(pagina, 10) || 1, 1), paginas);

    const usuarios = await base().usuario.findMany({
      where,
      orderBy: [{ nick: "asc" }],
      skip: (actual - 1) * tam,
      take: tam,
    });
    return { usuarios: usuarios.map(sinClave), total, pagina: actual, paginas, porPagina: tam };
  }

  static async banear(nick, motivo) {
    const usuario = await base().usuario.update({
      where: { nick: limpiarNick(nick) },
      data: { baneado: true, motivoBan: String(motivo || "").trim().slice(0, 200) || null, baneadoEl: new Date() },
    });
    return sinClave(usuario);
  }

  static async desbanear(nick) {
    const usuario = await base().usuario.update({
      where: { nick: limpiarNick(nick) },
      data: { baneado: false, motivoBan: null, baneadoEl: null },
    });
    return sinClave(usuario);
  }

  // El OWNER le pone una clave nueva (la vieja no se puede ver: está hasheada)
  static async ponerClave(nick, clave) {
    claves.revisarClave(clave);
    const usuario = await base().usuario.update({
      where: { nick: limpiarNick(nick) },
      data: { clave: claves.hashear(clave), claveCambiada: new Date() },
    });
    return sinClave(usuario);
  }

  // Para la sala: a quién echar al entrar (por nick y por auth)
  static async baneados() {
    const lista = await base().usuario.findMany({ where: { baneado: true }, select: { nick: true, auth: true, motivoBan: true } });
    return lista;
  }

  // Para el panel: deja al usuario sin clave, así se la vuelve a poner con !registrar
  static async borrarClave(nick) {
    const usuario = await base().usuario.update({
      where: { nick: limpiarNick(nick) },
      data: { clave: null, claveCambiada: null },
    });
    return sinClave(usuario);
  }
}

module.exports = UsuarioModel;
module.exports.limpiarEmail = limpiarEmail;
module.exports.revisarEmail = revisarEmail;
module.exports.sinClave = sinClave;
