// =============================================================================
// AnimacionesModel — las animaciones de gol: lo que le pasa al que hizo el gol mientras
// se festeja. Se arman desde el panel (solo OWNER y CO-OWNER) y se venden con monedas,
// igual que las camisetas (ver TiendaModel, que es el mismo circuito).
//
//   catalogo()                todas, para el panel
//   guardar(clave, datos)     crea o cambia una      ← solo OWNER y CO-OWNER
//   borrar(clave)             la saca (y la saca de los inventarios)
//   vitrina()                 las que están a la venta (público)
//   comprar(nick, clave)      descuenta las monedas y se la deja a esa cuenta
//   vender(nick, clave)       la saca del inventario y le devuelve el 70%
//   deLaCuenta(nick)          las que compró y cuál tiene puesta
//   elegir(nick, clave)       se pone una de las suyas (null = ninguna)
//   paraLaSala()              nick en minúscula → la animación que va a usar
//
// LOS TIPOS
//   "secuencia" le van pasando emojis o letras por encima del jugador (el avatar)
//   "tamano"    se hace grande y chico
//   "ambas"     las dos cosas a la vez
//
// CUÁNTO DURA: `cuadros.length * msPorCuadro`, o sea exactamente lo que dura la secuencia.
// La secuencia NUNCA se repite. Del lado del panel se elige el tiempo del festejo y los puntos
// se acomodan solos para llenarlo: si se sube la velocidad, el festejo sigue durando lo mismo
// y entran más puntos. La sala igual la corta cuando se saca del medio, así nunca se mete
// adentro del juego.
//
// El precio va en CENTÉSIMAS (1 moneda = 100), igual que el saldo.
// =============================================================================
const { base } = require("../services/ConexionBase");
const MonedasModel = require("./MonedasModel");

const DEVUELVE_AL_VENDER = 0.7;   // el 30% más barata, igual que las camisetas

const TIPOS = ["secuencia", "tamano", "ambas"];
// Cuántos puntos entran. El tope tiene que dar para llenar los 10 s con la velocidad más alta
// que se usa en la práctica: la duración la manda el que la arma y los puntos la llenan, así
// que subir la velocidad NO acorta el festejo, solo hace que entren más puntos en el mismo
// tiempo. Con 10 puntos no alcanzaba ni para 3 s a velocidad media.
const MAX_CUADROS = 50;
const LIMITES = {
  msPorCuadro: { min: 60, max: 2000 },
  duracionMs: { min: 300, max: 10000 },
  tamano: { min: 0.3, max: 3 },
};

const entre = (valor, { min, max }) => Math.min(max, Math.max(min, valor));

// Un cuadro es UN emoji o UNA letra. HaxBall no muestra más de 2 caracteres en el avatar,
// así que se recorta ahí mismo: más largo no se vería y solo confundiría al que la arma.
//
// Los cuadros y los tamaños van EN PARALELO: mismo largo y misma posición, así cada punto
// puede tener su emoji, su tamaño, o las dos cosas. Un cuadro vacío ("") es un punto que solo
// cambia el tamaño, y por eso acá NO se filtran los vacíos: se perdería el orden.
function limpiarPuntos(cuadros, tamanos) {
  const lista = Array.isArray(cuadros) ? cuadros : String(cuadros || "").split(/\s+/);
  const limpios = lista
    .map((c) => [...String(c == null ? "" : c).trim()].slice(0, 2).join(""))
    .slice(0, MAX_CUADROS);

  const crudos = Array.isArray(tamanos) ? tamanos : [];
  const medidas = limpios.map((_, i) => {
    const t = Number(crudos[i]);
    return Number.isFinite(t) ? Math.round(entre(t, LIMITES.tamano) * 100) / 100 : 1;
  });

  return { cuadros: limpios, tamanos: medidas };
}

// ¿Este punto hace algo? (tiene emoji o cambia el tamaño)
const puntoSirve = (emoji, tamano) => Boolean(emoji) || Number(tamano) !== 1;

const paraMostrar = (a) => ({
  clave: a.clave,
  nombre: a.nombre,
  descripcion: a.descripcion,
  detalle: a.detalle,
  tipo: a.tipo,
  cuadros: a.cuadros,
  tamanos: a.tamanos,
  msPorCuadro: a.msPorCuadro,
  tamanoDesde: a.tamanoDesde,
  tamanoHasta: a.tamanoHasta,
  duracionMs: a.duracionMs,
  activa: a.activa,
  orden: a.orden,
  enTienda: a.enTienda,
  precio: MonedasModel.enMonedas(a.precio || 0),
  sinPrecio: a.precio === null,
});

class AnimacionesModel {
  static TIPOS = TIPOS;
  static MAX_CUADROS = MAX_CUADROS;
  static LIMITES = LIMITES;

  // ── El panel ──
  static async catalogo() {
    const todas = await base().animacion.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
    return todas.map(paraMostrar);
  }

  // Crea o cambia. La clave es el nombre corto con el que se la identifica.
  static async guardar(clave, datos, quien) {
    const cual = String(clave || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(cual)) {
      throw new Error("La clave va en minúsculas, sin espacios ni acentos (letras, números y guiones), de 2 a 30");
    }

    const nombre = String(datos.nombre || "").trim();
    if (!nombre) throw new Error("Ponele un nombre");

    const { cuadros, tamanos } = limpiarPuntos(datos.cuadros, datos.tamanos);
    const sirveAlguno = cuadros.some((c, i) => puntoSirve(c, tamanos[i]));
    if (!sirveAlguno) {
      throw new Error("Hace falta al menos un punto con un emoji, una letra o un tamaño distinto");
    }

    // El tipo sale de lo que se cargó, no hace falta elegirlo: si hay emojis es "secuencia",
    // si algún punto cambia el tamaño es "tamano", y si hay de las dos cosas es "ambas".
    const hayEmojis = cuadros.some(Boolean);
    const hayTamanos = tamanos.some((t) => t !== 1);
    const tipo = hayEmojis && hayTamanos ? "ambas" : hayEmojis ? "secuencia" : "tamano";

    const msPorCuadro = Math.round(entre(Number(datos.msPorCuadro) || 200, LIMITES.msPorCuadro));

    const guardar = {
      nombre,
      descripcion: String(datos.descripcion || "").trim().slice(0, 200) || null,
      tipo,
      cuadros,
      tamanos,
      msPorCuadro: msPorCuadro,
      tamanoDesde: entre(Number(datos.tamanoDesde) || 1, LIMITES.tamano),
      tamanoHasta: entre(Number(datos.tamanoHasta) || 1, LIMITES.tamano),
      // EL FESTEJO DURA LO QUE DURA LA SECUENCIA: no se repite ni se corta a la mitad.
      // Para que dure más se agregan puntos o se baja la velocidad, que es lo que se entiende.
      // Igual se respeta el tope (10 s), y la sala la corta al sacar del medio.
      duracionMs: Math.round(entre(cuadros.length * msPorCuadro, LIMITES.duracionMs)),
      activa: datos.activa === undefined ? true : Boolean(datos.activa),
      orden: Math.round(Number(datos.orden) || 0),
      cambiadoPor: quien || null,
      cambiado: new Date(),
    };

    if (datos.precio !== undefined && datos.precio !== null && datos.precio !== "") {
      const centesimas = MonedasModel.aCentesimas(Number(datos.precio));
      if (!Number.isFinite(centesimas) || centesimas < 0) throw new Error("El precio no es válido");
      guardar.precio = centesimas;
    }
    if (datos.enTienda !== undefined) guardar.enTienda = Boolean(datos.enTienda);

    const existe = await base().animacion.findUnique({ where: { clave: cual } });
    if (guardar.enTienda && guardar.precio === undefined && (!existe || existe.precio === null)) {
      throw new Error("Ponele un precio antes de mostrarla en la tienda");
    }

    const salida = existe
      ? await base().animacion.update({ where: { clave: cual }, data: guardar })
      : await base().animacion.create({ data: { clave: cual, ...guardar } });
    return paraMostrar(salida);
  }

  // La borra del catálogo y de los inventarios, y se la saca al que la tuviera puesta
  static async borrar(clave) {
    const cual = String(clave || "").trim().toLowerCase();
    const existe = await base().animacion.findUnique({ where: { clave: cual } });
    if (!existe) throw new Error("Esa animación no existe");
    await base().animacionComprada.deleteMany({ where: { animacion: cual } });
    await base().usuario.updateMany({ where: { animacion: cual }, data: { animacion: null } });
    await base().animacion.delete({ where: { clave: cual } });
    return { borrada: cual };
  }

  // ── La tienda ──
  static async vitrina() {
    const enVenta = await base().animacion.findMany({
      where: { enTienda: true, activa: true, NOT: { precio: null } },
      orderBy: [{ precio: "asc" }, { nombre: "asc" }],
    });
    return enVenta.map(paraMostrar);
  }

  static async comprar(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const animacion = await base().animacion.findUnique({ where: { clave: cual } });
    if (!animacion || !animacion.enTienda || !animacion.activa || animacion.precio === null) {
      throw new Error("Esa animación no está a la venta");
    }

    const yaLaTiene = await base().animacionComprada.findUnique({ where: { nick_animacion: { nick: quien, animacion: cual } } });
    if (yaLaTiene) throw new Error("Ya tenés esa animación");

    const saldo = await MonedasModel.saldo(quien);
    if (saldo < animacion.precio) {
      const faltan = MonedasModel.enMonedas(animacion.precio - saldo);
      throw new Error(`No te alcanza: te faltan ${faltan} monedas. Ganá partidos para juntar más.`);
    }

    await MonedasModel.acreditar({
      nick: quien,
      monto: -animacion.precio,
      motivo: "compra",
      detalle: `Animación ${animacion.nombre}`,
    });
    await base().animacionComprada.create({ data: { nick: quien, animacion: cual, precio: animacion.precio } });

    return {
      animacion: paraMostrar(animacion),
      saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)),
    };
  }

  // Se devuelve el 70% de lo que pagó. Si la tenía puesta, se la saca.
  static async vender(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const comprada = await base().animacionComprada.findUnique({ where: { nick_animacion: { nick: quien, animacion: cual } } });
    if (!comprada) throw new Error("Esa animación no está en tu inventario");

    const devuelve = Math.round(comprada.precio * DEVUELVE_AL_VENDER);
    const animacion = await base().animacion.findUnique({ where: { clave: cual } });

    await base().animacionComprada.delete({ where: { id: comprada.id } });
    await base().usuario.updateMany({ where: { nick: quien, animacion: cual }, data: { animacion: null } });
    await MonedasModel.acreditar({
      nick: quien,
      monto: devuelve,
      motivo: "venta",
      detalle: `Animación ${animacion ? animacion.nombre : cual}`,
    });

    return {
      devuelto: MonedasModel.enMonedas(devuelve),
      saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)),
    };
  }

  // ── El inventario de cada uno ──
  static async deLaCuenta(nick) {
    const quien = String(nick || "").trim();
    const compradas = await base().animacionComprada.findMany({ where: { nick: quien } });
    const usuario = await base().usuario.findUnique({ where: { nick: quien }, select: { animacion: true } });
    if (!compradas.length) return { animaciones: [], puesta: usuario ? usuario.animacion : null };

    const fichas = await base().animacion.findMany({ where: { clave: { in: compradas.map((c) => c.animacion) } } });
    const porClave = new Map(fichas.map((a) => [a.clave, a]));
    return {
      animaciones: compradas
        .filter((c) => porClave.has(c.animacion))
        .map((c) => ({
          ...paraMostrar(porClave.get(c.animacion)),
          pagada: MonedasModel.enMonedas(c.precio),
          vale: MonedasModel.enMonedas(Math.round(c.precio * DEVUELVE_AL_VENDER)),
          comprada: c.comprada,
        })),
      puesta: usuario ? usuario.animacion : null,
    };
  }

  static async elegir(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = clave === null || clave === undefined || clave === "" ? null : String(clave).trim().toLowerCase();
    if (cual) {
      const tiene = await base().animacionComprada.findUnique({ where: { nick_animacion: { nick: quien, animacion: cual } } });
      if (!tiene) throw new Error("Esa animación no es tuya: compralá primero en la web");
    }
    await base().usuario.update({ where: { nick: quien }, data: { animacion: cual } });
    return { puesta: cual };
  }

  // ── Lo que el launcher le manda a la sala ──
  // nick en minúscula → la animación que tiene puesta (solo lo que la sala necesita)
  static async paraLaSala() {
    const usuarios = await base().usuario.findMany({
      where: { NOT: { animacion: null } },
      select: { nick: true, animacion: true },
    });
    if (!usuarios.length) return {};
    const fichas = await base().animacion.findMany({
      where: { clave: { in: usuarios.map((u) => u.animacion) }, activa: true },
    });
    const porClave = new Map(fichas.map((a) => [a.clave, a]));
    const salida = {};
    for (const u of usuarios) {
      const a = porClave.get(u.animacion);
      if (!a) continue;
      salida[u.nick.toLowerCase()] = {
        clave: a.clave,
        nombre: a.nombre,
        tipo: a.tipo,
        cuadros: a.cuadros,
        tamanos: a.tamanos,
        msPorCuadro: a.msPorCuadro,
        tamanoDesde: a.tamanoDesde,
        tamanoHasta: a.tamanoHasta,
        duracionMs: a.duracionMs,
      };
    }
    return salida;
  }

  // Las compradas de varios, para el comando !animaciones de la sala
  static async deVariasCuentas(nicks) {
    const lista = (nicks || []).map((n) => String(n || "").trim()).filter(Boolean);
    if (!lista.length) return {};
    const compradas = await base().animacionComprada.findMany({ where: { nick: { in: lista } } });
    if (!compradas.length) return {};
    const fichas = await base().animacion.findMany({ where: { clave: { in: compradas.map((c) => c.animacion) }, activa: true } });
    const porClave = new Map(fichas.map((a) => [a.clave, a]));
    const salida = {};
    for (const c of compradas) {
      const a = porClave.get(c.animacion);
      if (!a) continue;
      const nick = c.nick.toLowerCase();
      if (!salida[nick]) salida[nick] = [];
      salida[nick].push({ clave: a.clave, nombre: a.nombre });
    }
    return salida;
  }
}

module.exports = AnimacionesModel;
module.exports.DEVUELVE_AL_VENDER = DEVUELVE_AL_VENDER;
