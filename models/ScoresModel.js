// =============================================================================
// ScoresModel — los carteles de gol: cómo se ve el aviso con el marcador cuando alguien
// convierte. Se arman desde el panel (solo OWNER y CO-OWNER) y se venden con monedas,
// igual que las camisetas y las animaciones (mismo circuito que TiendaModel).
//
//   catalogo()                todos, para el panel
//   guardar(clave, datos)     crea o cambia uno       ← solo OWNER y CO-OWNER
//   borrar(clave)             lo saca (y lo saca de los inventarios)
//   vitrina()                 los que están a la venta (público)
//   comprar / vender / deLaCuenta / elegir            igual que las otras tiendas
//   paraLaSala()              nick en minúscula → el cartel que va a usar
//   armar(plantilla, datos)   reemplaza los huecos (la usan la sala y la vista previa)
//
// LOS HUECOS de la plantilla son los datos del gol. Se resuelven en la sala y también en la
// previsualización del panel, con la MISMA función, así lo que se ve al armarlo es lo que
// va a salir en el chat.
// =============================================================================
const { base } = require("../services/ConexionBase");
const MonedasModel = require("./MonedasModel");
const MercadoModel = require("./MercadoModel");

const DEVUELVE_AL_VENDER = 0.7;
const loQueVale = (precioDeHoy, loQuePago) =>
  Math.max(0, Math.round((precioDeHoy === null || precioDeHoy === undefined ? loQuePago : precioDeHoy) * DEVUELVE_AL_VENDER));

const ESTILOS = ["normal", "bold", "small"];
const LARGO_MAXIMO = 240;   // dos líneas largas: más no entra en el chat de HaxBall

// Los huecos que se pueden usar, con un ejemplo para la vista previa
const HUECOS = [
  { hueco: "{jugador}", que: "El que hizo el gol", ejemplo: "JINDER" },
  { hueco: "{equipo}", que: "Su equipo", ejemplo: "OLIMPIA" },
  { hueco: "{rival}", que: "El otro equipo", ejemplo: "CERRO PORTEÑO" },
  { hueco: "{golesPropios}", que: "Los goles de su equipo", ejemplo: "3" },
  { hueco: "{golesRival}", que: "Los goles del otro", ejemplo: "1" },
  { hueco: "{minuto}", que: "A qué minuto fue", ejemplo: "12:34" },
  { hueco: "{asistencia}", que: "Quién se la pasó (vacío si nadie)", ejemplo: "FAXSS" },
];

const PLANTILLA_DE_EJEMPLO = "⚽ ¡GOL DE {jugador}! {equipo} {golesPropios} 🆚 {golesRival} {rival}";

// Reemplaza los huecos. Lo usa la sala y también la vista previa del panel: así no hay dos
// versiones de la misma cuenta que se puedan despegar.
function armar(plantilla, datos) {
  let texto = String(plantilla || "");
  for (const { hueco } of HUECOS) {
    const nombre = hueco.slice(1, -1);
    const valor = datos && datos[nombre] !== undefined && datos[nombre] !== null ? String(datos[nombre]) : "";
    texto = texto.split(hueco).join(valor);
  }
  // Si la asistencia queda vacía, se limpian los dobles espacios que deja
  return texto.replace(/[ \t]{2,}/g, "  ").trim();
}

const paraMostrar = (s) => ({
  clave: s.clave,
  nombre: s.nombre,
  descripcion: s.descripcion,
  detalle: s.detalle,
  plantilla: s.plantilla,
  color: s.color,
  estilo: s.estilo,
  sonido: s.sonido,
  activo: s.activo,
  orden: s.orden,
  enTienda: s.enTienda,
  precio: MonedasModel.enMonedas(s.precio || 0),
  sinPrecio: s.precio === null,
  // Ya resuelto con datos de ejemplo, para mostrarlo sin tener que rearmarlo en el navegador
  ejemplo: armar(s.plantilla, Object.fromEntries(HUECOS.map((h) => [h.hueco.slice(1, -1), h.ejemplo]))),
});

class ScoresModel {
  static ESTILOS = ESTILOS;
  static HUECOS = HUECOS;
  static LARGO_MAXIMO = LARGO_MAXIMO;
  static PLANTILLA_DE_EJEMPLO = PLANTILLA_DE_EJEMPLO;
  static armar = armar;

  // ── El panel ──
  static async catalogo() {
    const todos = await base().score.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
    return todos.map(paraMostrar);
  }

  static async guardar(clave, datos, quien) {
    const cual = String(clave || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(cual)) {
      throw new Error("La clave va en minúsculas, sin espacios ni acentos (letras, números y guiones), de 2 a 30");
    }

    const nombre = String(datos.nombre || "").trim();
    if (!nombre) throw new Error("Ponele un nombre");

    const plantilla = String(datos.plantilla || "").trim();
    if (!plantilla) throw new Error("Escribí cómo se ve el cartel");
    if (plantilla.length > LARGO_MAXIMO) throw new Error(`El cartel no puede pasar de ${LARGO_MAXIMO} caracteres`);

    const color = String(datos.color || "FFD700").replace(/^#/, "").toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(color)) throw new Error("El color va en 6 números o letras (por ejemplo FFD700)");

    const guardar = {
      nombre,
      descripcion: String(datos.descripcion || "").trim().slice(0, 200) || null,
      plantilla,
      color,
      estilo: ESTILOS.includes(datos.estilo) ? datos.estilo : "bold",
      sonido: [0, 1, 2].includes(Number(datos.sonido)) ? Number(datos.sonido) : 2,
      activo: datos.activo === undefined ? true : Boolean(datos.activo),
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

    const existe = await base().score.findUnique({ where: { clave: cual } });
    if (guardar.enTienda && guardar.precio === undefined && (!existe || existe.precio === null)) {
      throw new Error("Ponele un precio antes de mostrarlo en la tienda");
    }

    const salida = existe
      ? await base().score.update({ where: { clave: cual }, data: guardar })
      : await base().score.create({ data: { clave: cual, ...guardar } });
    await MercadoModel.anotarPrecio("score", cual, salida.precio, quien).catch(() => {});
    return paraMostrar(salida);
  }

  static async borrar(clave) {
    const cual = String(clave || "").trim().toLowerCase();
    const existe = await base().score.findUnique({ where: { clave: cual } });
    if (!existe) throw new Error("Ese cartel no existe");
    await base().scoreComprado.deleteMany({ where: { score: cual } });
    await base().usuario.updateMany({ where: { score: cual }, data: { score: null } });
    await MercadoModel.olvidarFavoritos("score", cual).catch(() => {});
    await base().score.delete({ where: { clave: cual } });
    return { borrado: cual };
  }

  // ── La tienda ──
  static async vitrina() {
    const enVenta = await base().score.findMany({
      where: { enTienda: true, activo: true, NOT: { precio: null } },
      orderBy: [{ precio: "asc" }, { nombre: "asc" }],
    });
    return enVenta.map(paraMostrar);
  }

  static async comprar(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const score = await base().score.findUnique({ where: { clave: cual } });
    if (!score || !score.enTienda || !score.activo || score.precio === null) throw new Error("Ese cartel no está a la venta");

    const yaLoTiene = await base().scoreComprado.findUnique({ where: { nick_score: { nick: quien, score: cual } } });
    if (yaLoTiene) throw new Error("Ya tenés ese cartel");

    const saldo = await MonedasModel.saldo(quien);
    if (saldo < score.precio) {
      const faltan = MonedasModel.enMonedas(score.precio - saldo);
      throw new Error(`No te alcanza: te faltan ${faltan} monedas. Ganá partidos para juntar más.`);
    }

    await MonedasModel.acreditar({ nick: quien, monto: -score.precio, motivo: "compra", detalle: `Cartel de gol ${score.nombre}` });
    await base().scoreComprado.create({ data: { nick: quien, score: cual, precio: score.precio } });

    return { score: paraMostrar(score), saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)) };
  }

  static async vender(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const comprado = await base().scoreComprado.findUnique({ where: { nick_score: { nick: quien, score: cual } } });
    if (!comprado) throw new Error("Ese cartel no está en tu inventario");

    const score = await base().score.findUnique({ where: { clave: cual } });
    const devuelve = loQueVale(score ? score.precio : null, comprado.precio);

    await base().scoreComprado.delete({ where: { id: comprado.id } });
    await base().usuario.updateMany({ where: { nick: quien, score: cual }, data: { score: null } });
    await MonedasModel.acreditar({ nick: quien, monto: devuelve, motivo: "venta", detalle: `Cartel de gol ${score ? score.nombre : cual}` });

    return {
      devuelto: MonedasModel.enMonedas(devuelve),
      saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)),
    };
  }

  // ── El inventario ──
  static async deLaCuenta(nick) {
    const quien = String(nick || "").trim();
    const comprados = await base().scoreComprado.findMany({ where: { nick: quien } });
    const usuario = await base().usuario.findUnique({ where: { nick: quien }, select: { score: true } });
    if (!comprados.length) return { scores: [], puesto: usuario ? usuario.score : null };

    const fichas = await base().score.findMany({ where: { clave: { in: comprados.map((c) => c.score) } } });
    const porClave = new Map(fichas.map((s) => [s.clave, s]));
    return {
      scores: comprados
        .filter((c) => porClave.has(c.score))
        .map((c) => ({
          ...paraMostrar(porClave.get(c.score)),
          pagada: MonedasModel.enMonedas(c.precio),
          vale: MonedasModel.enMonedas(loQueVale(porClave.get(c.score).precio, c.precio)),
          comprada: c.comprada,
        })),
      puesto: usuario ? usuario.score : null,
    };
  }

  static async elegir(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = clave === null || clave === undefined || clave === "" ? null : String(clave).trim().toLowerCase();
    if (cual) {
      const tiene = await base().scoreComprado.findUnique({ where: { nick_score: { nick: quien, score: cual } } });
      if (!tiene) throw new Error("Ese cartel no es tuyo: compralo primero en la web");
    }
    await base().usuario.update({ where: { nick: quien }, data: { score: cual } });
    return { puesto: cual };
  }

  // ── Lo que el launcher le manda a la sala ──
  static async paraLaSala() {
    const usuarios = await base().usuario.findMany({ where: { NOT: { score: null } }, select: { nick: true, score: true } });
    if (!usuarios.length) return {};
    const fichas = await base().score.findMany({ where: { clave: { in: usuarios.map((u) => u.score) }, activo: true } });
    const porClave = new Map(fichas.map((s) => [s.clave, s]));
    const salida = {};
    for (const u of usuarios) {
      const s = porClave.get(u.score);
      if (!s) continue;
      salida[u.nick.toLowerCase()] = {
        clave: s.clave,
        nombre: s.nombre,
        plantilla: s.plantilla,
        color: s.color,
        estilo: s.estilo,
        sonido: s.sonido,
      };
    }
    return salida;
  }

  static async deVariasCuentas(nicks) {
    const lista = (nicks || []).map((n) => String(n || "").trim()).filter(Boolean);
    if (!lista.length) return {};
    const comprados = await base().scoreComprado.findMany({ where: { nick: { in: lista } } });
    if (!comprados.length) return {};
    const fichas = await base().score.findMany({ where: { clave: { in: comprados.map((c) => c.score) }, activo: true } });
    const porClave = new Map(fichas.map((s) => [s.clave, s]));
    const salida = {};
    for (const c of comprados) {
      const s = porClave.get(c.score);
      if (!s) continue;
      const nick = c.nick.toLowerCase();
      if (!salida[nick]) salida[nick] = [];
      salida[nick].push({ clave: s.clave, nombre: s.nombre });
    }
    return salida;
  }
}

module.exports = ScoresModel;
