// Espía la sala para el panel: mira los eventos sin reemplazar los handlers del script.
//
// Corre DENTRO de la página (el launcher le manda el código con toString()), así que tiene
// que ser una función autónoma: nada de require ni de variables de afuera.
//
// El problema que resuelve: el script y nuestros bloques reasignan el mismo handler varias
// veces (onPlayerChat lo tocan el script, la selección por turnos y los modos de equipos).
// Si envolviéramos cada asignación, un solo mensaje se registraría una vez por capa y el
// panel lo mostraba 3 veces. Por eso:
//
//   · la capa que registra se instala UNA sola vez por evento;
//   · el handler de verdad se guarda aparte y se reemplaza sin agregar capas;
//   · al leer room.onX se devuelve ese handler, sin nuestra capa, para que quien encadene
//     (`var anterior = room.onPlayerChat`) no se lleve una copia del espía.

function crearSalaEspiada(sala, avisar) {
  const nombre = (jugador) => (jugador && jugador.name) || "—";

  const espiados = {
    // Así entrega HaxBall el link de la sala; leerlo del HTML no es confiable
    onRoomLink: (url) => avisar({ tipo: "link", link: url }),
    onPlayerChat: (j, m) => avisar({ tipo: "chat", jugador: nombre(j), texto: m }),
    onPlayerJoin: (j) => avisar({ tipo: "entra", jugador: nombre(j) }),
    onPlayerLeave: (j) => avisar({ tipo: "sale", jugador: nombre(j) }),
    onPlayerKicked: (j, motivo, ban, por) => avisar({ tipo: "expulsion", jugador: nombre(j), motivo, ban, porJugador: por ? nombre(por) : null }),
    onTeamGoal: (equipo) => avisar({ tipo: "gol", equipo }),
    onGameStart: () => avisar({ tipo: "partido", enJuego: true }),
    onGameStop: () => avisar({ tipo: "partido", enJuego: false }),
  };

  const handlers = {};    // el handler de verdad de cada evento (la cadena del script)
  const instalado = {};   // eventos que ya tienen puesta nuestra capa

  return new Proxy(sala, {
    set(destino, prop, valor) {
      const espia = espiados[prop];
      if (!espia) {
        destino[prop] = valor;
        return true;
      }

      handlers[prop] = valor;
      if (!instalado[prop]) {
        instalado[prop] = true;
        destino[prop] = (...args) => {
          try {
            espia(...args);
          } catch (e) {
            // Un fallo del panel nunca debe romper la sala
          }
          const actual = handlers[prop];
          return typeof actual === "function" ? actual(...args) : undefined;
        };
      }
      return true;
    },

    get(destino, prop) {
      // Para los eventos espiados devolvemos el handler pelado: el que encadena se
      // queda con la cadena del script, no con nuestra capa
      if (espiados[prop] && Object.prototype.hasOwnProperty.call(handlers, prop)) {
        return handlers[prop];
      }
      const valor = destino[prop];
      if (prop === "clearBans" && typeof valor === "function") {
        return (...args) => {
          avisar({ tipo: "bans-limpios" });
          return valor.apply(destino, args);
        };
      }
      return typeof valor === "function" ? valor.bind(destino) : valor;
    },
  });
}

module.exports = { crearSalaEspiada };
