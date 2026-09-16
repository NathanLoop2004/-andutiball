// =============================================================================
// ConexionBase — elige a qué base se habla según DB_ENV, igual que el
// services/ConexionFirebird.js del Visualizador de facturas.
//
//   DB_ENV=produccion | testing | desarrollo   (si falta, desarrollo)
//
// El require es dinámico: solo se abre el cliente del entorno activo, no los tres.
// Y es PEREZOSO: la conexión se arma recién cuando alguien pide base(). Así el
// launcher y el panel siguen funcionando aunque Postgres no esté levantado — hoy
// la base es opcional y nada del host depende de ella.
//
//   const { base, entornoActivo } = require("./services/ConexionBase");
//   const jugadores = await base().jugador.findMany();
// =============================================================================

const ENTORNOS = {
  produccion: "./ConexionPostgresProduccion",
  testing: "./ConexionPostgresTesting",
  desarrollo: "./ConexionPostgresDesarrollo",
};

const entornoActivo = (process.env.DB_ENV || "desarrollo").trim().toLowerCase();

if (!ENTORNOS[entornoActivo]) {
  throw new Error(`DB_ENV no válido: "${entornoActivo}". Usá produccion, testing o desarrollo.`);
}

let cliente = null;

// El cliente de Prisma del entorno activo. Tira si no hay con qué conectarse.
function base() {
  if (cliente) return cliente;
  try {
    cliente = require(ENTORNOS[entornoActivo]).cliente;
  } catch (error) {
    throw new Error(
      `No se pudo abrir la base (${entornoActivo}): ${error.message}\n` +
      `   👉 Levantala con: npm run base\n` +
      `   👉 Y generá el cliente con: npm run base:generar`
    );
  }
  return cliente;
}

// Para el panel: ¿la base está andando? No tira, devuelve true/false.
async function hayBase() {
  try {
    await base().$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

async function cerrarBase() {
  if (cliente) await cliente.$disconnect();
  cliente = null;
}

module.exports = { base, hayBase, cerrarBase, entornoActivo, ENTORNOS };
