// =============================================================================
// SalasModel — la lista de salas que muestra el panel.
//
// Dos situaciones, la misma respuesta:
//   · Panel (Docker o npm start): tiene varias salas remotas y le pregunta a cada
//     una por HTTP (/api/estado de esa sala).
//   · Una sola sala (npm run sala 4v4): no hay remotas, se devuelve la local.
//
// Una sala que no contesta no rompe el panel: vuelve con { ok: false, error }.
// =============================================================================
const EstadoModel = require("./EstadoModel");

const TIMEOUT_MS = 2500;

class SalasModel {
  // Lee la variable de entorno SALAS: "clave|nombre|url" separadas por comas
  static desdeTexto(texto) {
    return String(texto || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [clave, nombre, url] = s.split("|");
        return { clave, nombre: nombre || clave, url };
      });
  }

  static buscar(salas, clave) {
    return (salas || []).find((s) => s.clave === clave) || null;
  }

  static async consultar(sala) {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      const respuesta = await fetch(`${sala.url}/api/estado`, { signal: control.signal });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return { ...sala, ok: true, estado: await respuesta.json() };
    } catch (error) {
      return { ...sala, ok: false, error: error.name === "AbortError" ? "sin respuesta" : error.message };
    } finally {
      clearTimeout(corte);
    }
  }

  static async listar({ sala = null, salas = [] } = {}) {
    if (salas.length) return Promise.all(salas.map((s) => SalasModel.consultar(s)));
    const estado = EstadoModel.obtener(sala);
    return estado ? [{ clave: "sala", nombre: estado.sala, ok: true, estado }] : [];
  }
}

module.exports = SalasModel;
