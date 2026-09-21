// =============================================================================
// MercadoModel — lo que las tres tiendas (camisetas, animaciones y carteles de gol)
// tienen en común:
// cómo se fue moviendo el precio, cuánta gente lo compró y a cuánta le gusta.
//
//   anotarPrecio(tipo, clave, centesimas, quien)   guarda un punto del historial
//   ficha(tipo, clave, nick)                       lo que muestra la página de cada cosa
//   marcarFavorito(nick, tipo, clave)              lo pone o lo saca de favoritos
//
// De los favoritos se muestra SOLO EL NÚMERO, nunca quiénes son: a nadie le importa que se
// sepa qué camiseta le gusta, y publicarlo sería regalar datos de la gente sin motivo.
//
// El historial no se borra nunca, ni siquiera cuando el artículo sale de la tienda: es el
// registro de cómo se movió el precio. Se guarda un punto solo cuando el precio CAMBIA, así
// no se llena de filas repetidas cada vez que alguien toca el nombre o la descripción.
// =============================================================================
const { base } = require("../services/ConexionBase");
const MonedasModel = require("./MonedasModel");

// Los tres tipos de cosas que se venden. Si aparece una cuarta, se agrega acá y en
// cuantosCompraron(), que es lo único que cambia entre una y otra.
const TIPOS = ["camiseta", "animacion", "score"];
const PUNTOS_MAXIMOS = 30;   // los últimos cambios, que es lo que se muestra

const revisarTipo = (tipo) => {
  const t = String(tipo || "").trim().toLowerCase();
  if (!TIPOS.includes(t)) throw new Error("Eso no es nada de lo que se vende en la tienda");
  return t;
};

class MercadoModel {
  static TIPOS = TIPOS;

  // Guarda un punto del historial, solo si el precio cambió de verdad
  static async anotarPrecio(tipo, clave, centesimas, quien) {
    const t = revisarTipo(tipo);
    const cual = String(clave || "").trim().toLowerCase();
    if (centesimas === null || centesimas === undefined) return null;

    const ultimo = await base().precioHistorial.findFirst({
      where: { tipo: t, clave: cual },
      orderBy: { cuando: "desc" },
    });
    if (ultimo && ultimo.precio === centesimas) return ultimo;

    return base().precioHistorial.create({
      data: { tipo: t, clave: cual, precio: centesimas, quien: quien || null },
    });
  }

  static async historial(tipo, clave) {
    const t = revisarTipo(tipo);
    const cual = String(clave || "").trim().toLowerCase();
    const filas = await base().precioHistorial.findMany({
      where: { tipo: t, clave: cual },
      orderBy: { cuando: "desc" },
      take: PUNTOS_MAXIMOS,
    });
    // Se devuelven del más viejo al más nuevo, que es como se lee un historial
    return filas.reverse().map((f) => ({ precio: MonedasModel.enMonedas(f.precio), cuando: f.cuando }));
  }

  // Cuántos la compraron. Sale de la tabla de compras de cada tienda.
  static async cuantosCompraron(tipo, clave) {
    const t = revisarTipo(tipo);
    const cual = String(clave || "").trim().toLowerCase();
    if (t === "camiseta") return base().camisetaComprada.count({ where: { equipo: cual } });
    if (t === "animacion") return base().animacionComprada.count({ where: { animacion: cual } });
    return base().scoreComprado.count({ where: { score: cual } });
  }

  static async cuantosFavoritos(tipo, clave) {
    const t = revisarTipo(tipo);
    return base().favorito.count({ where: { tipo: t, clave: String(clave || "").trim().toLowerCase() } });
  }

  // Todo junto, que es lo que pide la página de cada cosa.
  // `nick` es opcional: con sesión, además dice si a esa persona le gusta.
  static async ficha(tipo, clave, nick) {
    const t = revisarTipo(tipo);
    const cual = String(clave || "").trim().toLowerCase();
    const quien = String(nick || "").trim();

    const [historial, compraron, favoritos, mio] = await Promise.all([
      MercadoModel.historial(t, cual),
      MercadoModel.cuantosCompraron(t, cual),
      MercadoModel.cuantosFavoritos(t, cual),
      quien
        ? base().favorito.findUnique({ where: { nick_tipo_clave: { nick: quien, tipo: t, clave: cual } } })
        : Promise.resolve(null),
    ]);

    const precios = historial.map((h) => h.precio);
    return {
      compraron,
      favoritos,
      esFavorito: Boolean(mio),
      historial,
      // Para no tener que recorrer el historial del lado del navegador
      masBarato: precios.length ? Math.min(...precios) : null,
      masCaro: precios.length ? Math.max(...precios) : null,
      cambiosDePrecio: Math.max(0, precios.length - 1),
    };
  }

  // Lo pone o lo saca de favoritos, y devuelve cómo quedó
  static async marcarFavorito(nick, tipo, clave) {
    const t = revisarTipo(tipo);
    const cual = String(clave || "").trim().toLowerCase();
    const quien = String(nick || "").trim();
    if (!quien) throw new Error("Hace falta iniciar sesión");

    const donde = { nick_tipo_clave: { nick: quien, tipo: t, clave: cual } };
    const tenia = await base().favorito.findUnique({ where: donde });
    if (tenia) await base().favorito.delete({ where: donde });
    else await base().favorito.create({ data: { nick: quien, tipo: t, clave: cual } });

    return {
      esFavorito: !tenia,
      favoritos: await MercadoModel.cuantosFavoritos(t, cual),
    };
  }

  // Las claves que esa persona marcó, para pintar el corazón en la portada
  static async misFavoritos(nick) {
    const quien = String(nick || "").trim();
    const vacio = () => Object.fromEntries(TIPOS.map((t) => [t, []]));
    if (!quien) return vacio();
    const filas = await base().favorito.findMany({ where: { nick: quien }, select: { tipo: true, clave: true } });
    const salida = vacio();
    for (const f of filas) if (salida[f.tipo]) salida[f.tipo].push(f.clave);
    return salida;
  }

  // Cuando se borra un artículo, se lleva sus favoritos (el historial de precios queda)
  static async olvidarFavoritos(tipo, clave) {
    const t = revisarTipo(tipo);
    return base().favorito.deleteMany({ where: { tipo: t, clave: String(clave || "").trim().toLowerCase() } });
  }
}

module.exports = MercadoModel;
