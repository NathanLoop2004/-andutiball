// =============================================================================
// RangosModel — lo que la pantalla de rangos del panel lee y guarda.
//
// La fuente de la verdad es la tabla `rangos` (RangoModel). roles.json queda como
// ESPEJO: se escribe junto con la tabla y se usa solo si la base está apagada, para que
// una sala no se quede sin admins.
//
// La clave sigue viviendo en roles.json (es la del host, no es de ningún usuario) y
// nunca sale al navegador: sinClave() la cambia por tieneClave.
// =============================================================================
const { leerRangos, guardarRangos, sinClave } = require("../lib/rangos");
const RangoModel = require("./RangoModel");

class RangosModel {
  static async listar() {
    const { rangos, desde } = await RangoModel.listarConRespaldo();
    const { clave } = leerRangos();
    return {
      ...sinClave({ clave, roles: rangos.map((r) => ({ id: String(r.id), nombre: r.nombre, admin: Boolean(r.admin), nicks: r.nicks || [] })) }),
      desde,
    };
  }

  static async guardar(enviado) {
    if (!enviado || typeof enviado !== "object") throw new Error("Cuerpo inválido");
    const actual = leerRangos();
    const clave = enviado.clave ? enviado.clave : actual.clave;

    try {
      await RangoModel.guardarTodos(enviado.roles, { clave });
      return RangosModel.listar();
    } catch (error) {
      // Sin base no se pierde lo que escribieron: queda en el espejo y se avisa.
      // No es un error: el panel tiene que poder trabajar igual.
      guardarRangos({ clave, roles: Array.isArray(enviado.roles) ? enviado.roles : [] });
      return {
        ...(await RangosModel.listar()),
        aviso: "La base no está levantada: se guardó en roles.json. Copialo a la tabla cuando vuelva.",
      };
    }
  }
}

module.exports = RangosModel;
