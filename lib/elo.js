// Sistema de ELO: cada jugador tiene un puntaje que sube si gana y baja si pierde,
// y ese puntaje lo ubica en una división (Novato, Amateur, ... , Leyenda).
//
// Se guarda en datos/elo.json, del lado de Node, así sobrevive a que se cierre la sala
// y el panel lo puede leer. Las 4 salas comparten el mismo archivo.

const fs = require("fs");
const path = require("path");

const ARCHIVO = process.env.ELO_FILE || path.join(__dirname, "..", "datos", "elo.json");

const ELO_INICIAL = 1000;
const K_BASE = 32;          // cuánto se mueve el puntaje por partido
const K_NOVATO = 48;        // los primeros partidos mueven más, para ubicar rápido al jugador
const PARTIDOS_NOVATO = 10;

// De menor a mayor. El jugador queda en la última división cuyo "desde" alcanzó.
const DIVISIONES = [
  { desde: 0, nombre: "Novato", emoji: "🥉", color: "9b8b7a" },
  { desde: 900, nombre: "Amateur", emoji: "🟢", color: "2ecc71" },
  { desde: 1050, nombre: "Regular", emoji: "🔵", color: "3498db" },
  { desde: 1200, nombre: "Avanzado", emoji: "🟣", color: "9b59b6" },
  { desde: 1350, nombre: "Crack", emoji: "🟠", color: "e67e22" },
  { desde: 1500, nombre: "Pro", emoji: "🔴", color: "e74c3c" },
  { desde: 1700, nombre: "Leyenda", emoji: "🏆", color: "ffd100" },
];

function divisionDe(elo) {
  let division = DIVISIONES[0];
  for (const d of DIVISIONES) if (elo >= d.desde) division = d;
  return division;
}

// Cuánto le falta para subir de división (null si ya está en la más alta)
function faltaParaSubir(elo) {
  const siguiente = DIVISIONES.find((d) => d.desde > elo);
  return siguiente ? { nombre: siguiente.nombre, emoji: siguiente.emoji, puntos: siguiente.desde - Math.round(elo) } : null;
}

function leerElo() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
    return datos && typeof datos === "object" ? datos : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error("⚠️ elo.json no se pudo leer:", error.message);
    return {};
  }
}

function guardarElo(tabla) {
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(tabla, null, 2) + "\n");
}

// La clave es el auth del jugador (su Public ID, que no se puede falsear).
// Si no hay auth, caemos al nick: es lo único que queda.
function claveDe(jugador) {
  return jugador.auth ? "auth:" + jugador.auth : "nick:" + String(jugador.nombre || jugador.name || "").toLowerCase();
}

function fichaDe(tabla, jugador) {
  const clave = claveDe(jugador);
  if (!tabla[clave]) {
    tabla[clave] = { nombre: jugador.nombre || jugador.name || "?", elo: ELO_INICIAL, partidos: 0, ganados: 0, perdidos: 0, empatados: 0, goles: 0 };
  }
  // El nick puede cambiar: guardamos siempre el último
  if (jugador.nombre || jugador.name) tabla[clave].nombre = jugador.nombre || jugador.name;
  return tabla[clave];
}

const promedio = (fichas) => (fichas.length ? fichas.reduce((s, f) => s + f.elo, 0) / fichas.length : ELO_INICIAL);

/**
 * Aplica el resultado de un partido a la tabla.
 * @param {object} tabla       tabla de ELO (se modifica)
 * @param {object} partido     { red: [jugadores], blue: [jugadores], ganador: 1 | 2 | 0, goles: {nombre: cantidad} }
 * @returns {Array} cambios: [{ nombre, antes, despues, delta, division }]
 */
function aplicarPartido(tabla, partido) {
  const red = (partido.red || []).map((j) => fichaDe(tabla, j));
  const blue = (partido.blue || []).map((j) => fichaDe(tabla, j));
  if (!red.length || !blue.length) return [];

  const eloRed = promedio(red);
  const eloBlue = promedio(blue);
  // Probabilidad de que gane cada equipo según la diferencia de puntaje
  const esperadoRed = 1 / (1 + Math.pow(10, (eloBlue - eloRed) / 400));
  const esperadoBlue = 1 - esperadoRed;

  const resultadoRed = partido.ganador === 1 ? 1 : partido.ganador === 2 ? 0 : 0.5;
  const resultadoBlue = 1 - resultadoRed;

  const cambios = [];
  const ajustar = (fichas, esperado, resultado) => {
    for (const ficha of fichas) {
      const k = ficha.partidos < PARTIDOS_NOVATO ? K_NOVATO : K_BASE;
      const antes = ficha.elo;
      ficha.elo = Math.max(100, Math.round(ficha.elo + k * (resultado - esperado)));
      ficha.partidos++;
      if (resultado === 1) ficha.ganados++;
      else if (resultado === 0) ficha.perdidos++;
      else ficha.empatados++;
      ficha.goles += (partido.goles && partido.goles[ficha.nombre]) || 0;
      cambios.push({
        nombre: ficha.nombre,
        antes,
        despues: ficha.elo,
        delta: ficha.elo - antes,
        division: divisionDe(ficha.elo),
        subio: divisionDe(ficha.elo).nombre !== divisionDe(antes).nombre && ficha.elo > antes,
        bajo: divisionDe(ficha.elo).nombre !== divisionDe(antes).nombre && ficha.elo < antes,
      });
    }
  };
  ajustar(red, esperadoRed, resultadoRed);
  ajustar(blue, esperadoBlue, resultadoBlue);
  return cambios;
}

// Tabla ordenada de mayor a menor, lista para mostrar
function ranking(tabla, limite = 100) {
  return Object.entries(tabla)
    .map(([clave, f]) => ({ clave, ...f, division: divisionDe(f.elo) }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limite);
}

// Lo que se le manda a la página: nombre → elo/división/color, para el chat y los anuncios
function paraLaSala(tabla) {
  const salida = {};
  for (const f of Object.values(tabla)) {
    const d = divisionDe(f.elo);
    salida[f.nombre.toLowerCase()] = {
      elo: f.elo,
      partidos: f.partidos,
      division: d.nombre,
      emoji: d.emoji,
      color: parseInt(d.color, 16),   // HaxBall pide el color como número
    };
  }
  return salida;
}

module.exports = { ARCHIVO, ELO_INICIAL, DIVISIONES, divisionDe, faltaParaSubir, leerElo, guardarElo, fichaDe, aplicarPartido, ranking, paraLaSala, claveDe };
