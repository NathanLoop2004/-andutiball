// =============================================================================
// AjustesModel — los ajustes generales de la web (tabla `ajustes`).
//
// Los cambia SOLO el OWNER, desde el panel (Ajustes). Sirven para apagar cosas cuando algo de
// afuera se rompe: por ejemplo, si el correo no anda, se apaga el código por correo y la gente
// puede crear su cuenta igual.
//
//   · En la tabla solo queda lo que se cambió; el resto sale del CATALOGO (valor de fábrica).
//   · Se leen muchas veces por pedido (al registrarse), así que se guardan en memoria
//     SEGUNDOS_CACHE segundos. Con la base apagada se usan los valores de fábrica.
// =============================================================================
const { base } = require("../services/ConexionBase");

const SEGUNDOS_CACHE = 10;

const CATALOGO = [
  {
    clave: "pedirCodigoDeCorreo",
    grupo: "Crear cuenta",
    etiqueta: "Pedir el código por correo",
    ayuda: "Apagalo si el correo no está funcionando: la cuenta se crea sin confirmar la dirección.",
    porDefecto: true,
  },
  {
    clave: "revisarQueExistaElCorreo",
    grupo: "Crear cuenta",
    etiqueta: "Revisar que el correo exista",
    ayuda: "Mira las reglas de Gmail y si el dominio recibe correos (por ejemplo, rechaza gmial.com).",
    porDefecto: true,
  },
  {
    clave: "pedirCorreo",
    grupo: "Crear cuenta",
    etiqueta: "Pedir correo electrónico",
    ayuda: "Apagado, se puede crear la cuenta sin correo. Ojo: después no hay cómo recuperarla.",
    porDefecto: true,
  },
  {
    clave: "permitirRegistro",
    grupo: "Crear cuenta",
    etiqueta: "Dejar crear cuentas nuevas",
    ayuda: "Apagado, nadie puede registrarse. Los que ya tienen cuenta entran igual.",
    porDefecto: true,
  },
  {
    clave: "mostrarAnuncios",
    grupo: "Anuncios",
    etiqueta: "Mostrar anuncios en la web",
    ayuda: "Muestra la publicidad en la portada. Necesita ADSENSE_CLIENTE en el .env; sin eso no sale nada aunque esté prendido.",
    porDefecto: false,
  },
];

const POR_CLAVE = new Map(CATALOGO.map((a) => [a.clave, a]));

let cache = null;   // { valores, hasta }

class AjustesModel {
  static CATALOGO = CATALOGO;

  // { clave: valor } con los de fábrica y, encima, lo que diga la base.
  // Si la base está apagada, los de fábrica (la web no se cae por esto).
  static async valores() {
    if (cache && cache.hasta > Date.now()) return cache.valores;
    const valores = {};
    for (const a of CATALOGO) valores[a.clave] = a.porDefecto;
    try {
      const filas = await base().ajuste.findMany();
      for (const f of filas) if (POR_CLAVE.has(f.clave)) valores[f.clave] = f.valor;
    } catch (error) {
      console.warn("⚠️ Ajustes: no se pudieron leer de la base, se usan los de fábrica (" + String(error.message).split("\n")[0] + ")");
      cache = { valores, hasta: Date.now() + SEGUNDOS_CACHE * 1000 };
      return valores;
    }
    cache = { valores, hasta: Date.now() + SEGUNDOS_CACHE * 1000 };
    return valores;
  }

  static async valor(clave) {
    const valores = await AjustesModel.valores();
    return valores[clave];
  }

  // Para la pantalla del panel: el catálogo con el valor puesto y quién lo cambió
  static async lista() {
    const valores = await AjustesModel.valores();
    const filas = await base().ajuste.findMany();
    const cambios = new Map(filas.map((f) => [f.clave, f]));
    return CATALOGO.map((a) => {
      const f = cambios.get(a.clave);
      return { ...a, valor: valores[a.clave], cambiado: Boolean(f), cambiadoPor: f ? f.cambiadoPor : null, cuando: f ? f.cambiado : null };
    });
  }

  static async guardar(clave, valor, quien) {
    const ficha = POR_CLAVE.get(clave);
    if (!ficha) throw new Error(`"${clave}" no es un ajuste que se pueda cambiar`);
    const limpio = Boolean(valor);
    cache = null;
    // Volver al de fábrica = no guardar nada
    if (limpio === ficha.porDefecto) {
      await base().ajuste.deleteMany({ where: { clave } });
      return { clave, valor: limpio, cambiado: false };
    }
    await base().ajuste.upsert({
      where: { clave },
      update: { valor: limpio, cambiadoPor: quien || null, cambiado: new Date() },
      create: { clave, valor: limpio, cambiadoPor: quien || null },
    });
    return { clave, valor: limpio, cambiado: true };
  }

  static olvidarCache() {
    cache = null;
  }
}

module.exports = AjustesModel;
