// =============================================================================
// ActualizacionModel — la tabla `actualizaciones`: las novedades que se le cuentan
// a la gente en el Discord.
//
// El circuito es siempre el mismo:
//   1. se guarda la novedad  → estado "pendiente"  (crear)
//   2. alguien la lee en el panel y le da enviar → se manda al webhook
//   3. queda como "enviada" con la fecha, o como "error" con el motivo
//
// Nada sale al Discord sin pasar antes por la tabla.
// =============================================================================
const { base } = require("../services/ConexionBase");
const WebhookActualizaciones = require("../services/WebhookActualizaciones");

const LARGO_MAXIMO = 4000;

class ActualizacionModel {
  static async listar({ estado, limite = 50 } = {}) {
    return base().actualizacion.findMany({
      where: estado ? { estado } : undefined,
      orderBy: [{ creada: "desc" }],
      take: Math.min(Number(limite) || 50, 200),
    });
  }

  static async pendientes() {
    return ActualizacionModel.listar({ estado: "pendiente", limite: 200 });
  }

  static async crear({ titulo, mensaje, origen = "manual", commit = null } = {}) {
    const texto = String(mensaje || "").trim();
    if (!texto) throw new Error("La novedad no puede estar vacía");

    return base().actualizacion.create({
      data: {
        titulo: titulo ? String(titulo).trim().slice(0, 250) : null,
        mensaje: texto.slice(0, LARGO_MAXIMO),
        origen: origen === "commit" ? "commit" : "manual",
        commit: commit ? String(commit).trim().slice(0, 60) : null,
      },
    });
  }

  static async borrar(id) {
    return base().actualizacion.delete({ where: { id: Number(id) } });
  }

  // Manda una novedad al Discord y deja anotado cómo salió
  static async enviar(id) {
    const actualizacion = await base().actualizacion.findUnique({ where: { id: Number(id) } });
    if (!actualizacion) throw new Error("Esa novedad no existe");
    if (actualizacion.estado === "enviada") throw new Error("Esa novedad ya se mandó");

    try {
      await WebhookActualizaciones.enviar(actualizacion);
      return base().actualizacion.update({
        where: { id: actualizacion.id },
        data: { estado: "enviada", enviada: new Date(), error: null },
      });
    } catch (error) {
      await base().actualizacion.update({
        where: { id: actualizacion.id },
        data: { estado: "error", error: error.message.slice(0, 500) },
      });
      throw error;
    }
  }

  // Manda todas las que estén esperando. Una que falle no frena a las demás.
  static async enviarPendientes() {
    const pendientes = await ActualizacionModel.pendientes();
    const resultado = { enviadas: 0, fallaron: 0, errores: [] };
    for (const pendiente of pendientes.reverse()) {   // de la más vieja a la más nueva
      try {
        await ActualizacionModel.enviar(pendiente.id);
        resultado.enviadas++;
      } catch (error) {
        resultado.fallaron++;
        resultado.errores.push({ id: pendiente.id, error: error.message });
      }
    }
    return resultado;
  }
}

module.exports = ActualizacionModel;
