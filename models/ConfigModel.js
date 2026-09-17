// =============================================================================
// ConfigModel — los parámetros de juego de cada sala y los comandos apagados.
//
// Lo tocan desde el panel los rangos OWNER, CO-OWNER, HOSTER y AYUDANTE (middleware
// puedeConfigurar). Las salas lo leen cada pocos segundos (launcher → bloque ⚙️ CONFIGURACIÓN).
//
// En la tabla solo queda lo que se cambió: si se vuelve al valor por defecto, se borra la fila.
// =============================================================================
const { base } = require("../services/ConexionBase");
const Parametros = require("../lib/parametros");

const TODAS = "*";
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function revisarSala(sala, { permitirTodas = false } = {}) {
  const clave = String(sala || "").trim();
  if (permitirTodas && clave === TODAS) return clave;
  if (!Parametros.salas().some((s) => s.clave === clave)) throw new Error(`No existe la sala "${clave}"`);
  return clave;
}

function limpiarComando(comando) {
  const c = String(comando || "").trim().toLowerCase();
  if (!/^![a-z][a-z0-9_]{1,30}$/.test(c)) throw new Error("Ese comando no es válido");
  return c;
}

class ConfigModel {
  static TODAS = TODAS;

  static salas() {
    return Parametros.salas();
  }

  // Todo lo que muestra la pantalla de una sala: cada parámetro con su valor, el de fábrica y
  // quién lo cambió
  static async deSala(sala) {
    const clave = revisarSala(sala);
    const filas = await base().parametroSala.findMany({ where: { sala: clave } });
    const cambios = new Map(filas.map((f) => [f.nombre, f]));

    return {
      sala: clave,
      grupos: Parametros.GRUPOS,
      parametros: Parametros.CATALOGO.map((p) => {
        const fila = cambios.get(p.nombre);
        const porDefecto = Parametros.valorPorDefecto(clave, p.nombre);
        return {
          ...p,
          valor: fila ? fila.valor : porDefecto,
          porDefecto,
          cambiado: Boolean(fila),
          cambiadoPor: fila ? fila.cambiadoPor : null,
          cuando: fila ? fila.cambiado : null,
        };
      }),
    };
  }

  static async guardar(sala, nombre, valor, quien) {
    const clave = revisarSala(sala);
    const limpio = Parametros.validar(nombre, valor);
    const porDefecto = Parametros.valorPorDefecto(clave, nombre);

    // Volver al de fábrica = no guardar nada
    if (igual(limpio, porDefecto)) {
      await base().parametroSala.deleteMany({ where: { sala: clave, nombre } });
      return { nombre, valor: limpio, cambiado: false, aplica: Parametros.POR_NOMBRE.get(nombre).aplica };
    }
    await base().parametroSala.upsert({
      where: { sala_nombre: { sala: clave, nombre } },
      update: { valor: limpio, cambiadoPor: quien || null },
      create: { sala: clave, nombre, valor: limpio, cambiadoPor: quien || null },
    });
    return { nombre, valor: limpio, cambiado: true, aplica: Parametros.POR_NOMBRE.get(nombre).aplica };
  }

  static async restablecer(sala, nombre) {
    const clave = revisarSala(sala);
    if (!Parametros.POR_NOMBRE.has(nombre)) throw new Error(`"${nombre}" no es un parámetro que se pueda cambiar`);
    await base().parametroSala.deleteMany({ where: { sala: clave, nombre } });
    return { nombre, valor: Parametros.valorPorDefecto(clave, nombre), cambiado: false };
  }

  // ── Comandos ──
  static async comandos(sala) {
    const clave = revisarSala(sala);
    const apagados = await base().comandoApagado.findMany({ where: { sala: { in: [clave, TODAS] } } });
    const aca = new Map(apagados.filter((a) => a.sala === clave).map((a) => [a.comando, a]));
    const enTodas = new Map(apagados.filter((a) => a.sala === TODAS).map((a) => [a.comando, a]));

    return {
      sala: clave,
      comandos: Parametros.comandosDelScript().map((comando) => ({
        comando,
        protegido: Parametros.COMANDOS_PROTEGIDOS.includes(comando),
        apagadoAca: aca.has(comando),
        apagadoEnTodas: enTodas.has(comando),
        apagadoPor: (aca.get(comando) || enTodas.get(comando) || {}).apagadoPor || null,
      })),
    };
  }

  // sala puede ser "*" (todas)
  static async cambiarComando(sala, comando, activo, quien) {
    const clave = revisarSala(sala, { permitirTodas: true });
    const c = limpiarComando(comando);
    if (!activo && Parametros.COMANDOS_PROTEGIDOS.includes(c)) throw new Error(`${c} no se puede apagar: sin él nadie con cuenta podría jugar`);

    if (activo) {
      await base().comandoApagado.deleteMany({ where: { sala: clave, comando: c } });
    } else {
      await base().comandoApagado.upsert({
        where: { sala_comando: { sala: clave, comando: c } },
        update: { apagadoPor: quien || null },
        create: { sala: clave, comando: c, apagadoPor: quien || null },
      });
    }
    return { sala: clave, comando: c, activo: Boolean(activo) };
  }

  // ── Para la sala (launcher) ──
  // Solo lo que se cambió desde el panel: lo demás ya viene en el script.
  static async cambiosDeLaSala(sala) {
    const filas = await base().parametroSala.findMany({ where: { sala } });
    const valores = {};
    for (const f of filas) if (Parametros.POR_NOMBRE.has(f.nombre)) valores[f.nombre] = f.valor;
    return valores;
  }

  // Lo que la sala aplica en vivo: el valor de cada parámetro "vivo" y los comandos apagados
  static async paraLaSala(sala) {
    const cambios = await ConfigModel.cambiosDeLaSala(sala);
    const parametros = {};
    for (const p of Parametros.CATALOGO) {
      if (p.aplica !== "vivo") continue;
      parametros[p.nombre] = Object.prototype.hasOwnProperty.call(cambios, p.nombre) ? cambios[p.nombre] : Parametros.valorPorDefecto(sala, p.nombre);
    }
    const apagados = await base().comandoApagado.findMany({ where: { sala: { in: [sala, TODAS] } }, select: { comando: true } });
    return { parametros, comandosApagados: [...new Set(apagados.map((a) => a.comando))] };
  }
}

module.exports = ConfigModel;
