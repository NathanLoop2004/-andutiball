// =============================================================================
// ModeracionModel — expulsar (kick) y banear jugadores desde el panel.
//
// Según quién atienda el pedido hay dos caminos:
//   · La sala (launcher): se lo pide a la página de Puppeteer, que termina
//     llamando a room.kickPlayer(id, motivo, ban).
//   · El panel: no tiene la sala en la mano, así que reenvía el pedido a la sala
//     que corresponda (/api/kick o /api/ban de esa sala), con el MISMO Authorization del que
//     lo pidió: la sala vuelve a revisar el rango (ver middlewares/puedeModerar.js).
// =============================================================================
const EstadoModel = require("./EstadoModel");
const SalasModel = require("./SalasModel");

const MOTIVO_MAXIMO = 100;

class ModeracionModel {
  static motivoPorDefecto(banear) {
    return banear ? "Baneado desde el panel" : "Expulsado desde el panel";
  }

  // Devuelve { status, ok, error? } — el status lo usa el controller
  static async expulsar({ sala = null, salas = [] } = {}, { claveSala, id, motivo, banear, autorizacion } = {}) {
    if (!Number.isInteger(id)) return { status: 400, ok: false, error: "Falta el id del jugador" };
    const razon = String(motivo || ModeracionModel.motivoPorDefecto(banear)).slice(0, MOTIVO_MAXIMO);

    // Modo panel: la sala la maneja otro proceso
    if (salas.length) {
      const remota = SalasModel.buscar(salas, claveSala);
      if (!remota) return { status: 404, ok: false, error: "sala no encontrada" };
      return ModeracionModel.reenviar(remota, { id, motivo: razon }, banear, autorizacion);
    }

    if (!sala) return { status: 404, ok: false, error: "Esta instancia no maneja ninguna sala" };
    try {
      await EstadoModel.expulsar(sala, id, razon, Boolean(banear));
      return { status: 200, ok: true };
    } catch (error) {
      return { status: 400, ok: false, error: error.message };
    }
  }

  static async reenviar(remota, cuerpo, banear, autorizacion) {
    try {
      const respuesta = await fetch(`${remota.url}/api/${banear ? "ban" : "kick"}`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, autorizacion ? { Authorization: autorizacion } : {}),
        body: JSON.stringify(cuerpo),
      });
      const texto = await respuesta.text();
      let datos;
      try { datos = JSON.parse(texto); } catch { datos = { ok: respuesta.ok, error: texto }; }
      return { status: respuesta.status, ...datos };
    } catch (error) {
      return { status: 502, ok: false, error: error.message };
    }
  }
}

module.exports = ModeracionModel;
