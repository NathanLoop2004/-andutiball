// =============================================================================
// RangoModel — la tabla `rangos`: quién es OWNER, CO-OWNER, AYUDANTE…
//
// Es la fuente de la verdad de los rangos. La sala la relee cada pocos segundos y
// vuelve a aplicar lo que diga: si alguien se mete javascript en la página y se pone
// admin, a los 5 segundos se le cae, porque manda la tabla.
//
// Si la base está apagada se usa roles.json, que queda como espejo: así una sala nunca
// se queda sin rangos por culpa de Postgres.
// =============================================================================
const { base } = require("../services/ConexionBase");
const { leerRangos, guardarRangos } = require("../lib/rangos");

const igual = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const limpiarNicks = (nicks) => [...new Set((Array.isArray(nicks) ? nicks : []).map((n) => String(n).trim()).filter(Boolean))];

class RangoModel {
  // [{ id, nombre, admin, orden, nicks }] ordenados como se muestran
  static async listar() {
    return base().rango.findMany({ orderBy: [{ orden: "asc" }, { id: "asc" }] });
  }

  // Lo mismo, pero sin tirar si la base está apagada: ahí se usa roles.json
  static async listarConRespaldo() {
    try {
      const rangos = await RangoModel.listar();
      if (rangos.length) return { rangos, desde: "base" };
    } catch (error) {
      // la base no está: seguimos con el espejo
    }
    const { roles } = leerRangos();
    return {
      rangos: roles.map((r, i) => ({ id: i + 1, nombre: r.nombre, admin: r.admin, orden: i, nicks: r.nicks })),
      desde: "roles.json",
    };
  }

  // El rango de un nick (no distingue mayúsculas). null si no tiene.
  static async deNick(nick) {
    const { rangos } = await RangoModel.listarConRespaldo();
    for (const rango of rangos) {
      if ((rango.nicks || []).some((n) => igual(n, nick))) return { nombre: rango.nombre, admin: Boolean(rango.admin) };
    }
    return null;
  }

  // Lo que necesita la sala: nombre, si da admin, y los nicks
  static async paraLaSala() {
    const { rangos, desde } = await RangoModel.listarConRespaldo();
    return {
      desde,
      rangos: rangos.map((r) => ({ nombre: r.nombre, admin: Boolean(r.admin), nicks: r.nicks || [] })),
    };
  }

  static async crear({ nombre, admin = false, orden = 0, nicks = [] }) {
    if (!String(nombre || "").trim()) throw new Error("El rango necesita un nombre");
    return base().rango.create({
      data: { nombre: String(nombre).trim(), admin: Boolean(admin), orden: Number(orden) || 0, nicks: limpiarNicks(nicks) },
    });
  }

  // Reemplaza toda la lista de una (es lo que hace la pantalla de rangos del panel).
  // Deja roles.json igual, como espejo para cuando la base esté apagada.
  static async guardarTodos(roles, { clave } = {}) {
    const lista = (Array.isArray(roles) ? roles : []).map((r, i) => ({
      nombre: String(r.nombre || `ROL ${i + 1}`).trim().slice(0, 80),
      admin: Boolean(r.admin),
      orden: i,
      nicks: limpiarNicks(r.nicks),
    }));

    await base().$transaction([
      base().rango.deleteMany({}),
      ...lista.map((rango) => base().rango.create({ data: rango })),
    ]);

    try {
      const espejo = leerRangos();
      guardarRangos({ clave: clave !== undefined ? clave : espejo.clave, roles: lista });
    } catch (error) {
      console.warn("⚠️ No se pudo actualizar el espejo roles.json: " + error.message);
    }

    return RangoModel.listar();
  }

  // Le pone (o le saca) el rango a un nick
  static async asignarNick({ nombreRango, nick }) {
    const limpio = String(nick || "").trim();
    if (!limpio) throw new Error("Falta el nombre del jugador");
    const rangos = await RangoModel.listar();

    for (const rango of rangos) {
      const tiene = (rango.nicks || []).some((n) => igual(n, limpio));
      const debeTener = igual(rango.nombre, nombreRango);
      if (tiene === debeTener) continue;
      await base().rango.update({
        where: { id: rango.id },
        data: { nicks: debeTener ? [...rango.nicks, limpio] : rango.nicks.filter((n) => !igual(n, limpio)) },
      });
    }
    return RangoModel.deNick(limpio);
  }

  static async quitarNick(nick) {
    return RangoModel.asignarNick({ nombreRango: "__ninguno__", nick });
  }

  // Primera carga: copia lo que hay en roles.json a la tabla (solo si está vacía)
  static async sembrarDesdeJson() {
    const cuantos = await base().rango.count();
    if (cuantos > 0) return { sembrados: 0, yaHabia: cuantos };

    const { roles } = leerRangos();
    for (let i = 0; i < roles.length; i++) {
      await RangoModel.crear({ nombre: roles[i].nombre, admin: roles[i].admin, orden: i, nicks: roles[i].nicks });
    }
    return { sembrados: roles.length, yaHabia: 0 };
  }
}

module.exports = RangoModel;
