// =============================================================================
// PartidoModel — guarda en la base cada partido terminado: la fila en `partidos`, una
// `participaciones` por jugador y los números del usuario (elo, partidos, ganados...).
//
// El cálculo del ELO lo sigue haciendo lib/elo.js sobre datos/elo.json; acá se guarda
// el resultado. Si el jugador no tiene usuario todavía, se le crea uno sin clave (así el
// que después se registra en la web ya trae sus partidos).
// =============================================================================
const { base } = require("../services/ConexionBase");

class PartidoModel {
  /**
   * @param {object} partido  el evento "elo-partido" del script
   * @param {Array}  cambios  lo que devolvió aplicarPartido() (con equipo, auth, resultado, goles)
   * @param {object} sala     { clave, nombre }
   * @returns el partido creado
   */
  static async guardar(partido, cambios, sala = {}) {
    if (!cambios || !cambios.length) return null;
    const db = base();

    return db.$transaction(async (tx) => {
      if (sala.clave) {
        await tx.sala.upsert({
          where: { clave: sala.clave },
          update: { nombre: sala.nombre || sala.clave },
          create: { clave: sala.clave, nombre: sala.nombre || sala.clave },
        });
      }

      const creado = await tx.partido.create({
        data: {
          salaClave: sala.clave || null,
          mapa: partido.mapa || null,
          golesRed: Number(partido.golesRed) || 0,
          golesBlue: Number(partido.golesBlue) || 0,
          ganador: partido.ganador === 1 || partido.ganador === 2 ? partido.ganador : null,
          fin: new Date(),
        },
      });

      for (const c of cambios) {
        const nick = String(c.nombre || "").trim();
        if (!nick) continue;

        let usuario = await tx.usuario.findUnique({ where: { nick } });
        if (!usuario) {
          // El auth es único: solo se anota si no lo tiene otro usuario (alguien que cambió de nick)
          const authLibre = c.auth && !(await tx.usuario.findUnique({ where: { auth: c.auth } }));
          usuario = await tx.usuario.create({ data: { nick, auth: authLibre ? c.auth : null } });
        }

        await tx.usuario.update({
          where: { id: usuario.id },
          data: {
            elo: c.despues,
            partidos: { increment: 1 },
            ganados: { increment: c.resultado === 1 ? 1 : 0 },
            perdidos: { increment: c.resultado === 0 ? 1 : 0 },
            empatados: { increment: c.resultado === 0.5 ? 1 : 0 },
            goles: { increment: c.goles || 0 },
          },
        });

        await tx.participacion.create({
          data: {
            partidoId: creado.id,
            usuarioId: usuario.id,
            equipo: c.equipo || 1,
            goles: c.goles || 0,
            eloAntes: c.antes,
            eloDespues: c.despues,
          },
        });
      }

      return creado;
    });
  }
}

module.exports = PartidoModel;
