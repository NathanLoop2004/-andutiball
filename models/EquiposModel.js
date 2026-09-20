// =============================================================================
// EquiposModel — las camisetas de los clubes (tabla `equipos`) y los cruces del cambio
// automático, los "clásicos" (tabla `clasicos`).
//
// Antes estaban escritas a mano en `parches/camisetas.js`. Ahora se editan desde el panel
// (Equipos) y la sala las aplica EN VIVO, sin reiniciar: el launcher manda
// `window.__equiposSala({equipos, clasicos})` y el bloque 👕 CAMISETAS DESDE LA BASE rearma
// `camisetasEquipos` y `opciones` (ver parches/bloques/equipos.txt).
//
// Formato de HaxBall: ángulo + color del número + hasta 3 franjas.
//   /colors red 90 000000 FFFFFF 000000 FFFFFF   → Olimpia
//
// La primera vez la tabla se llena sola con lo que había en parches/camisetas.js (sembrar()).
// =============================================================================
const { base } = require("../services/ConexionBase");
const { KITS, CRUCES } = require("../parches/camisetas");

const COLOR = /^[0-9A-Fa-f]{6}$/;
const CLAVE = /^[a-z0-9-]{2,12}$/;

const limpiarColor = (valor, cual) => {
  const color = String(valor || "").trim().replace(/^#/, "").toUpperCase();
  if (!COLOR.test(color)) throw new Error(`${cual} tiene que ser un color de 6 dígitos (por ejemplo FFD100)`);
  return color;
};

const limpiarTexto = (valor, cual, largo = 40) => {
  const texto = String(valor == null ? "" : valor).trim();
  if (!texto) throw new Error(`Falta ${cual}`);
  if (texto.length > largo) throw new Error(`${cual} es muy largo (hasta ${largo})`);
  return texto;
};

// Lo que se guarda de un equipo, ya validado
function revisarEquipo(datos, { conClave = false } = {}) {
  const limpio = {
    nombre: limpiarTexto(datos.nombre, "el nombre", 30).toUpperCase(),
    descripcion: datos.descripcion ? String(datos.descripcion).trim().slice(0, 80) : null,
    division: datos.division ? String(datos.division).trim().slice(0, 40) : null,
    angulo: Number.isFinite(Number(datos.angulo)) ? Math.round(Number(datos.angulo)) : 0,
    // Solo la primera franja es obligatoria: las otras dos y el número tienen un valor razonable
    colorTexto: limpiarColor(datos.colorTexto || "FFFFFF", "el color del número"),
    color1: limpiarColor(datos.color1, "la primera franja"),
    color2: limpiarColor(datos.color2 || datos.color1, "la segunda franja"),
    color3: limpiarColor(datos.color3 || datos.color1, "la tercera franja"),
    activo: datos.activo === undefined ? true : Boolean(datos.activo),
    orden: Number.isFinite(Number(datos.orden)) ? Math.round(Number(datos.orden)) : 0,
  };
  if (limpio.angulo < 0 || limpio.angulo > 360) throw new Error("El ángulo va de 0 a 360");
  if (conClave) {
    const clave = String(datos.clave || "").trim().toLowerCase();
    if (!CLAVE.test(clave)) throw new Error("La clave son 2 a 12 letras o números, sin espacios (por ejemplo: oli)");
    limpio.clave = clave;
  }
  return limpio;
}

class EquiposModel {
  // La primera vez: pasa a la base lo que estaba en parches/camisetas.js
  static async sembrar() {
    const cuantos = await base().equipo.count();
    if (cuantos > 0) return { sembrados: 0, clasicos: 0 };

    let orden = 0;
    for (const [clave, kit] of Object.entries(KITS)) {
      await base().equipo.create({
        data: {
          clave,
          nombre: kit.nombre,
          descripcion: kit.com || null,
          division: null,
          angulo: kit.angle,
          colorTexto: kit.text.toUpperCase(),
          color1: kit.colors[0].toUpperCase(),
          color2: kit.colors[1].toUpperCase(),
          color3: kit.colors[2].toUpperCase(),
          orden: (orden += 10),
          cambiadoPor: "de fábrica",
        },
      });
    }
    for (const [red, blue, demanda] of CRUCES) {
      await base().clasico.upsert({
        where: { red_blue: { red, blue } },
        update: {},
        create: { red, blue, demanda, cambiadoPor: "de fábrica" },
      });
    }
    return { sembrados: Object.keys(KITS).length, clasicos: CRUCES.length };
  }

  static async listar() {
    await EquiposModel.sembrar();
    const [equipos, clasicos] = await Promise.all([
      base().equipo.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
      base().clasico.findMany({ orderBy: [{ demanda: "desc" }, { id: "asc" }] }),
    ]);
    return { equipos, clasicos };
  }

  static async guardarEquipo(clave, datos, quien) {
    const limpio = revisarEquipo(datos);
    const cual = String(clave || "").trim().toLowerCase();
    if (!CLAVE.test(cual)) throw new Error("Clave de equipo no válida");
    return base().equipo.update({ where: { clave: cual }, data: { ...limpio, cambiadoPor: quien || null, cambiado: new Date() } });
  }

  static async crearEquipo(datos, quien) {
    const limpio = revisarEquipo(datos, { conClave: true });
    const existe = await base().equipo.findUnique({ where: { clave: limpio.clave } });
    if (existe) throw new Error(`Ya hay un equipo con la clave "${limpio.clave}"`);
    const ultimo = await base().equipo.findFirst({ orderBy: { orden: "desc" } });
    return base().equipo.create({ data: { ...limpio, orden: limpio.orden || (ultimo ? ultimo.orden + 10 : 10), cambiadoPor: quien || null } });
  }

  static async borrarEquipo(clave) {
    const cual = String(clave || "").trim().toLowerCase();
    const usado = await base().clasico.findFirst({ where: { OR: [{ red: cual }, { blue: cual }] } });
    if (usado) throw new Error("Ese equipo está en un clásico: sacalo de ahí primero");
    await base().equipo.delete({ where: { clave: cual } });
    return { ok: true };
  }

  static async guardarClasico({ id, red, blue, demanda, activo }, quien) {
    const unoU = (valor) => String(valor || "").trim().toLowerCase();
    const rojo = unoU(red);
    const azul = unoU(blue);
    if (!rojo || !azul) throw new Error("Elegí los dos equipos");
    if (rojo === azul) throw new Error("Un clásico es entre dos equipos distintos");
    const cuantos = await base().equipo.count({ where: { clave: { in: [rojo, azul] } } });
    if (cuantos !== 2) throw new Error("Alguno de los dos equipos no existe");

    const peso = Math.min(Math.max(Math.round(Number(demanda) || 0), 1), 5000);
    const datos = { red: rojo, blue: azul, demanda: peso, activo: activo === undefined ? true : Boolean(activo), cambiadoPor: quien || null, cambiado: new Date() };
    if (id) return base().clasico.update({ where: { id: Number(id) }, data: datos });

    const repetido = await base().clasico.findUnique({ where: { red_blue: { red: rojo, blue: azul } } });
    if (repetido) return base().clasico.update({ where: { id: repetido.id }, data: datos });
    return base().clasico.create({ data: datos });
  }

  static async borrarClasico(id) {
    await base().clasico.delete({ where: { id: Number(id) } });
    return { ok: true };
  }

  // Lo que necesita la sala: las camisetas activas y los cruces que se pueden jugar
  static async paraLaSala() {
    const { equipos, clasicos } = await EquiposModel.listar();
    const activos = equipos.filter((e) => e.activo);
    const porClave = new Map(activos.map((e) => [e.clave, e]));
    return {
      equipos: activos.map((e) => ({
        clave: e.clave,
        nombre: e.nombre,
        angulo: e.angulo,
        texto: e.colorTexto,
        colores: [e.color1, e.color2, e.color3],
      })),
      clasicos: clasicos
        .filter((c) => c.activo && porClave.has(c.red) && porClave.has(c.blue))
        .map((c) => ({ red: c.red, blue: c.blue, demanda: c.demanda })),
    };
  }
}

module.exports = EquiposModel;
