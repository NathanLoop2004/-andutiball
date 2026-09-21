// =============================================================================
// PublicoModel — lo que se puede contar de las salas SIN sesión.
//
// Lo usa la extensión de ÑandutíHax (public/nandutihax.user.js), que corre en el navegador
// de cada jugador mientras juega y muestra un panel con el marcador y quién está en cancha.
//
// ES A PROPÓSITO UN SUBCONJUNTO CHICO. `/api/salas` (la del panel) devuelve el estado
// entero: la configuración de la sala, la tabla de rangos con los nicks de los admins, los
// bans, los mensajes del chat… Nada de eso tiene por qué salir a internet, así que acá se
// arma a mano lo poco que la extensión necesita:
//
//   · el nombre de la sala y si está abierta
//   · el link para entrar
//   · el marcador y los equipos que están jugando
//   · quiénes están en cada equipo, con su ELO (que ya es público en el ranking)
//
// Nunca: config, rangos, admins, bans, mensajes, IPs ni auths.
// =============================================================================

// De cada jugador solo lo que ya se ve entrando a la sala
const jugadorPublico = (j) => ({
  nombre: j.nombre,
  equipo: j.equipo,
  elo: j.elo === undefined ? null : j.elo,
  division: j.division || null,
  emoji: j.emoji || null,
});

function salaPublica(sala) {
  const estado = sala.estado || {};
  const partido = estado.partido || {};
  const jugadores = (estado.jugadores || [])
    .filter((j) => j.id !== 0)   // el bot no cuenta
    .map(jugadorPublico);

  return {
    clave: sala.clave,
    nombre: estado.sala || sala.nombre,
    abierta: Boolean(sala.ok && estado.encendida !== false && estado.link),
    link: estado.link || null,
    mapa: (estado.config && estado.config.MapaPorDefecto) || null,
    cupo: (estado.config && estado.config.CantidadDeJugadores) || null,
    marcador: {
      enJuego: Boolean(partido.enJuego),
      red: Number(partido.red || 0),
      blue: Number(partido.blue || 0),
    },
    jugadores,
    cuantos: jugadores.length,
  };
}

class PublicoModel {
  static salas(lista) {
    return (lista || []).map(salaPublica);
  }
}

module.exports = PublicoModel;
module.exports.salaPublica = salaPublica;
