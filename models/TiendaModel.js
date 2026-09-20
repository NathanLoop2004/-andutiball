// =============================================================================
// TiendaModel — la tienda de camisetas: se compran con las monedas que se ganan jugando.
//
//   vitrina()                 las camisetas en venta (esto es lo público: el carrusel de la portada)
//   ponerPrecio(clave, ...)   le pone precio y descripción a un equipo  ← solo OWNER y CO-OWNER
//   comprar(nick, clave)      descuenta las monedas y le deja la camiseta a esa cuenta
//   vender(nick, clave)       la saca del inventario y le devuelve el 70% de lo que pagó
//   deLaCuenta(nick)          las que tiene compradas y cuál está usando
//   elegir(nick, clave)       se pone una de las suyas (null = ninguna, vuelve al automático)
//
// El precio va en CENTÉSIMAS, igual que el saldo (1 moneda = 100), así 0,30 no se rompe.
// La compra y el descuento van en una sola transacción: o pasan las dos cosas o no pasa ninguna.
// =============================================================================
const { base } = require("../services/ConexionBase");
const MonedasModel = require("./MonedasModel");
const EquiposModel = require("./EquiposModel");
const MercadoModel = require("./MercadoModel");

// Cuánto se devuelve al vender: el 70% de lo que VALE HOY, no de lo que pagó en su momento.
// Si el precio subió o bajó desde que la compró, cobra por el de ahora — es lo que espera
// cualquiera que vende algo. Si la camiseta ya no tiene precio (se sacó de la tienda), se
// cae a lo que había pagado, que es lo único que se sabe.
const DEVUELVE_AL_VENDER = 0.7;
const loQueVale = (precioDeHoy, loQuePago) =>
  Math.max(0, Math.round((precioDeHoy === null || precioDeHoy === undefined ? loQuePago : precioDeHoy) * DEVUELVE_AL_VENDER));

const paraMostrar = (e) => ({
  clave: e.clave,
  nombre: e.nombre,
  descripcion: e.descripcion,
  detalle: e.detalle,
  division: e.division,
  angulo: e.angulo,
  colorTexto: e.colorTexto,
  colores: [e.color1, e.color2, e.color3],
  precio: MonedasModel.enMonedas(e.precio || 0),
});

class TiendaModel {
  // Lo ve cualquiera (sin sesión): es lo que se mueve en el carrusel de la portada
  static async vitrina() {
    await EquiposModel.sembrar();
    const equipos = await base().equipo.findMany({
      where: { enTienda: true, activo: true, NOT: { precio: null } },
      orderBy: [{ precio: "asc" }, { nombre: "asc" }],
    });
    return equipos.map(paraMostrar);
  }

  // Para el panel (OWNER y CO-OWNER): todos los equipos, estén o no a la venta
  static async paraElPanel() {
    const { equipos } = await EquiposModel.listar();
    const ventas = await base().camisetaComprada.groupBy({ by: ["equipo"], _count: { equipo: true } });
    const cuantas = new Map(ventas.map((v) => [v.equipo, v._count.equipo]));
    return equipos.map((e) => ({ ...paraMostrar(e), enTienda: e.enTienda, activo: e.activo, vendidas: cuantas.get(e.clave) || 0 }));
  }

  static async ponerPrecio(clave, { precio, enTienda, detalle }, quien) {
    const cual = String(clave || "").trim().toLowerCase();
    const equipo = await base().equipo.findUnique({ where: { clave: cual } });
    if (!equipo) throw new Error("Esa camiseta no existe");

    const datos = { cambiadoPor: quien || null, cambiado: new Date() };
    if (precio !== undefined && precio !== null && precio !== "") {
      const centesimas = MonedasModel.aCentesimas(precio);
      if (!Number.isFinite(centesimas) || centesimas < 0) throw new Error("El precio no es válido");
      datos.precio = centesimas;
    }
    if (enTienda !== undefined) datos.enTienda = Boolean(enTienda);
    if (detalle !== undefined) datos.detalle = String(detalle || "").trim().slice(0, 200) || null;
    if (datos.enTienda && !datos.precio && !equipo.precio) throw new Error("Ponele un precio antes de mostrarla en la tienda");

    const guardado = await base().equipo.update({ where: { clave: cual }, data: datos });
    // Queda anotado en el historial (solo si cambió de verdad)
    await MercadoModel.anotarPrecio("camiseta", cual, guardado.precio, quien).catch(() => {});
    return { ...paraMostrar(guardado), enTienda: guardado.enTienda };
  }

  static async comprar(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const equipo = await base().equipo.findUnique({ where: { clave: cual } });
    if (!equipo || !equipo.enTienda || !equipo.activo || equipo.precio === null) throw new Error("Esa camiseta no está a la venta");

    const yaLaTiene = await base().camisetaComprada.findUnique({ where: { nick_equipo: { nick: quien, equipo: cual } } });
    if (yaLaTiene) throw new Error("Ya tenés esa camiseta");

    const saldo = await MonedasModel.saldo(quien);
    if (saldo < equipo.precio) {
      const faltan = MonedasModel.enMonedas(equipo.precio - saldo);
      throw new Error(`No te alcanza: te faltan ${faltan} monedas. Ganá partidos para juntar más.`);
    }

    // El descuento y la compra van juntos: MonedasModel.acreditar ya usa una transacción
    await MonedasModel.acreditar({
      nick: quien,
      monto: -equipo.precio,
      motivo: "compra",
      detalle: `Camiseta de ${equipo.nombre}`,
    });
    await base().camisetaComprada.create({ data: { nick: quien, equipo: cual, precio: equipo.precio } });

    return {
      camiseta: paraMostrar(equipo),
      saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)),
    };
  }

  // Vender una camiseta del inventario: se devuelve el 70% de lo que pagó (un 30% menos).
  // La camiseta sale del inventario y, si la tenía puesta, se la saca.
  static async vender(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = String(clave || "").trim().toLowerCase();
    const compra = await base().camisetaComprada.findUnique({ where: { nick_equipo: { nick: quien, equipo: cual } } });
    if (!compra) throw new Error("Esa camiseta no está en tu inventario");

    const equipo = await base().equipo.findUnique({ where: { clave: cual } });
    const nombre = equipo ? equipo.nombre : cual;
    const devuelto = loQueVale(equipo ? equipo.precio : null, compra.precio);

    await base().camisetaComprada.delete({ where: { id: compra.id } });
    const usuario = await base().usuario.findUnique({ where: { nick: quien }, select: { camiseta: true } });
    if (usuario && usuario.camiseta === cual) await base().usuario.update({ where: { nick: quien }, data: { camiseta: null } });

    if (devuelto > 0) {
      await MonedasModel.acreditar({ nick: quien, monto: devuelto, motivo: "venta", detalle: `Vendiste la camiseta de ${nombre}` });
    }
    return {
      vendida: nombre,
      devuelto: MonedasModel.enMonedas(devuelto),
      pagaste: MonedasModel.enMonedas(compra.precio),
      saldo: MonedasModel.enMonedas(await MonedasModel.saldo(quien)),
    };
  }

  // Cuánto le dan por cada una si la vende (el 70% de lo que pagó)
  static cuantoDevuelve(pagado) {
    return MonedasModel.enMonedas(Math.max(0, Math.round(MonedasModel.aCentesimas(pagado) * DEVUELVE_AL_VENDER)));
  }

  // Las que compró + la que tiene puesta
  static async deLaCuenta(nick) {
    const quien = String(nick || "").trim();
    const [compradas, usuario] = await Promise.all([
      base().camisetaComprada.findMany({ where: { nick: quien }, orderBy: { comprada: "asc" } }),
      base().usuario.findUnique({ where: { nick: quien }, select: { camiseta: true } }),
    ]);
    if (!compradas.length) return { camisetas: [], puesta: null };

    const equipos = await base().equipo.findMany({ where: { clave: { in: compradas.map((c) => c.equipo) } } });
    const porClave = new Map(equipos.map((e) => [e.clave, e]));
    return {
      camisetas: compradas.filter((c) => porClave.has(c.equipo)).map((c) => ({
        ...paraMostrar(porClave.get(c.equipo)),
        pagada: MonedasModel.enMonedas(c.precio),
        vale: MonedasModel.enMonedas(loQueVale(porClave.get(c.equipo) ? porClave.get(c.equipo).precio : null, c.precio)),
        comprada: c.comprada,
      })),
      puesta: usuario ? usuario.camiseta : null,
    };
  }

  // Se pone una de las suyas. Con null se la saca y vuelve a la camiseta automática.
  static async elegir(nick, clave) {
    const quien = String(nick || "").trim();
    const cual = clave === null || clave === undefined || clave === "" ? null : String(clave).trim().toLowerCase();
    if (cual) {
      const tiene = await base().camisetaComprada.findUnique({ where: { nick_equipo: { nick: quien, equipo: cual } } });
      if (!tiene) throw new Error("Esa camiseta no es tuya: compralá primero en la web");
    }
    await base().usuario.update({ where: { nick: quien }, data: { camiseta: cual } });
    return { puesta: cual };
  }

  // Lo que le manda el launcher a la sala: nick (en minúscula) → la camiseta que eligió
  static async paraLaSala() {
    const usuarios = await base().usuario.findMany({ where: { NOT: { camiseta: null } }, select: { nick: true, camiseta: true } });
    if (!usuarios.length) return {};
    const equipos = await base().equipo.findMany({ where: { clave: { in: usuarios.map((u) => u.camiseta) }, activo: true } });
    const porClave = new Map(equipos.map((e) => [e.clave, e]));
    const salida = {};
    for (const u of usuarios) {
      const equipo = porClave.get(u.camiseta);
      if (!equipo) continue;
      salida[u.nick.toLowerCase()] = {
        clave: equipo.clave,
        nombre: equipo.nombre,
        angulo: equipo.angulo,
        texto: equipo.colorTexto,
        colores: [equipo.color1, equipo.color2, equipo.color3],
      };
    }
    return salida;
  }

  // Las compradas de varios, para el comando !camisetas de la sala
  static async deVariasCuentas(nicks) {
    const lista = (nicks || []).map((n) => String(n || "").trim()).filter(Boolean);
    if (!lista.length) return {};
    const compradas = await base().camisetaComprada.findMany({ where: { nick: { in: lista } } });
    if (!compradas.length) return {};
    const equipos = await base().equipo.findMany({ where: { clave: { in: compradas.map((c) => c.equipo) }, activo: true } });
    const porClave = new Map(equipos.map((e) => [e.clave, e]));
    const salida = {};
    for (const c of compradas) {
      const equipo = porClave.get(c.equipo);
      if (!equipo) continue;
      const llave = c.nick.toLowerCase();
      salida[llave] = salida[llave] || [];
      salida[llave].push({ clave: equipo.clave, nombre: equipo.nombre });
    }
    return salida;
  }
}

module.exports = TiendaModel;
