// Sistema de ELO: cada jugador tiene un puntaje que sube si gana y baja si pierde,
// y ese puntaje lo ubica en una división (Novato, Amateur, ... , Leyenda).
//
// Hay un ELO POR SALA (3v3, 4v4, todos, realsoccer) y uno GENERAL. Cada partido mueve solo el de
// su sala; el general se calcula a partir de las salas (promedio pesado por partidos).
//
// La fuente de la verdad es la base: tablas elo_<sala> y elo_general, y el procedimiento
// actualizar_elo_general() (ver models/EloSalasModel.js). Estos archivos son el ESPEJO que leen
// la sala y la web, y lo que se usa si la base está apagada:
//
//   leerElo()        → datos/elo.json          (general)
//   leerElo("3v3")   → datos/elo-3v3.json      (esa sala)

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

const GENERAL = "general";

// La clave de la sala va al nombre del archivo: solo letras, números y guiones (nada de "../")
function ambitoValido(ambito) {
  return ambito === undefined || ambito === null || ambito === GENERAL || /^[a-z0-9-]{1,20}$/.test(String(ambito));
}

function archivoDe(ambito) {
  if (ambito === undefined || ambito === null || ambito === GENERAL) return ARCHIVO;
  if (!ambitoValido(ambito)) throw new Error("Sala no válida para el ELO");
  return path.join(path.dirname(ARCHIVO), `elo-${ambito}.json`);
}

function leerElo(ambito) {
  const archivo = archivoDe(ambito);
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, "utf8"));
    return datos && typeof datos === "object" ? datos : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error(`⚠️ ${path.basename(archivo)} no se pudo leer:`, error.message);
    return {};
  }
}

function guardarElo(tabla, ambito) {
  const archivo = archivoDe(ambito);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(tabla, null, 2) + "\n");
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
 * @param {object} opciones   { cuenta(jugador) → true/false }: solo los que tienen cuenta se guardan en la
 *                             tabla. Los demás juegan con 1000 (para que la cuenta del partido sea
 *                             justa) pero no quedan en la tabla ni en los cambios. Sin cuenta(): todos.
 * @returns {Array} cambios: [{ nombre, antes, despues, delta, division }]
 */
function aplicarPartido(tabla, partido, { cuenta } = {}) {
  const sinCuenta = new Set();
  const fichaOInvitado = (j) => {
    if (!cuenta || cuenta(j)) return fichaDe(tabla, j);
    const invitado = { nombre: j.nombre || j.name || "?", elo: ELO_INICIAL, partidos: 0, ganados: 0, perdidos: 0, empatados: 0, goles: 0 };
    sinCuenta.add(invitado);
    return invitado;
  };
  const red = (partido.red || []).map(fichaOInvitado);
  const blue = (partido.blue || []).map(fichaOInvitado);
  // Para la base: de quién es cada ficha (el auth) y en qué equipo jugó
  const jugadores = new Map();
  (partido.red || []).forEach((j, i) => jugadores.set(red[i], { auth: j.auth || null, equipo: 1 }));
  (partido.blue || []).forEach((j, i) => jugadores.set(blue[i], { auth: j.auth || null, equipo: 2 }));
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
      if (sinCuenta.has(ficha)) continue;   // juega, pero sin cuenta no suma ni resta
      const k = ficha.partidos < PARTIDOS_NOVATO ? K_NOVATO : K_BASE;
      const antes = ficha.elo;
      ficha.elo = Math.max(100, Math.round(ficha.elo + k * (resultado - esperado)));
      ficha.partidos++;
      if (resultado === 1) ficha.ganados++;
      else if (resultado === 0) ficha.perdidos++;
      else ficha.empatados++;
      const goles = (partido.goles && partido.goles[ficha.nombre]) || 0;
      ficha.goles += goles;
      ficha.actualizado = new Date().toISOString();   // para saber cuál es el último nombre
      cambios.push({
        nombre: ficha.nombre,
        ...jugadores.get(ficha),
        resultado,
        goles,
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

// El ELO general a partir de las tablas de cada sala. Es LA MISMA cuenta que hace el
// procedimiento actualizar_elo_general() de la base; esta se usa cuando la base está apagada.
//   elo = promedio de los ELO de las salas, pesado por los partidos de cada una
//   partidos, ganados, empatados, perdidos, goles = la suma
//   nombre = el último con el que jugó
function calcularGeneral(tablasPorSala) {
  const juntos = {};
  for (const tabla of Object.values(tablasPorSala)) {
    for (const [clave, f] of Object.entries(tabla || {})) {
      const g = juntos[clave] || (juntos[clave] = { nombre: f.nombre, actualizado: f.actualizado || "", suma: 0, elo: ELO_INICIAL, partidos: 0, ganados: 0, empatados: 0, perdidos: 0, goles: 0 });
      g.suma += (f.elo || 0) * (f.partidos || 0);
      g.partidos += f.partidos || 0;
      g.ganados += f.ganados || 0;
      g.empatados += f.empatados || 0;
      g.perdidos += f.perdidos || 0;
      g.goles += f.goles || 0;
      if ((f.actualizado || "") >= g.actualizado) { g.actualizado = f.actualizado || ""; g.nombre = f.nombre; }
    }
  }
  const general = {};
  for (const [clave, g] of Object.entries(juntos)) {
    const { suma, ...resto } = g;
    general[clave] = { ...resto, elo: g.partidos > 0 ? Math.round(suma / g.partidos) : ELO_INICIAL };
  }
  return general;
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
      nombre: f.nombre,   // lo usa !top para mostrarlo (sin esto salía "undefined")
      elo: f.elo,
      partidos: f.partidos,
      division: d.nombre,
      emoji: d.emoji,
      color: parseInt(d.color, 16),   // HaxBall pide el color como número
    };
  }
  return salida;
}

module.exports = { ARCHIVO, GENERAL, archivoDe, ambitoValido, calcularGeneral, ELO_INICIAL, DIVISIONES, divisionDe, faltaParaSubir, leerElo, guardarElo, fichaDe, aplicarPartido, ranking, paraLaSala, claveDe };
