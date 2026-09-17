// Los parámetros de juego que se pueden cambiar desde el panel (Configuración), y los comandos.
//
// Cada parámetro es una variable de script.js. Su valor sale, en este orden:
//   1. la tabla parametros_sala (si alguien lo cambió desde el panel)
//   2. hosts/<sala>.json
//   3. lo que trae script.js
//
// aplica:
//   "vivo"     → la sala lo toma a los pocos segundos, sin reiniciar (bloque ⚙️ CONFIGURACIÓN)
//   "reinicio" → se usa al abrir la sala (nombre, cupo, intervalos): hace falta reiniciarla
//
// Ojo: solo van variables declaradas con var o let (las const no se pueden cambiar en vivo).

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SCRIPT = path.join(RAIZ, "script.js");
const HOSTS = path.join(RAIZ, "hosts");

const MAPAS = [
  "Futsal x2", "Futsal x3", "Futsal x4", "Futsal x5", "Futsal x5 cesped", "Futsal x7", "Real Futsal",
  "Entrenamiento Futsal", "Real Soccer", "Real Soccer Evo", "RS Realista", "RS Oveja", "Mini RS", "Entrenamiento",
  "Basquet", "Big", "Voley 2d", "Voley 3d", "Escuela", "Skate", "Handball", "Tenis Ladrillo", "Tenis Pasto",
  "Tenis Cemento", "Penales Red", "Penales Blue", "Campeones", "Premios",
  "2 Man", "3 Man", "4 Man", "5 Man", "6 Man", "7 Man", "8 Man",
];

const GRUPOS = [
  { id: "sala", nombre: "Sala" },
  { id: "partido", nombre: "Partido" },
  { id: "equipos", nombre: "Equipos" },
  { id: "turnos", nombre: "Selección por turnos" },
  { id: "arranque", nombre: "Arranque automático" },
  { id: "cuentas", nombre: "Cuentas y claves" },
  { id: "chat", nombre: "Chat y anuncios" },
  { id: "moderacion", nombre: "Moderación" },
];

const P = (grupo, nombre, etiqueta, tipo, extra = {}) => ({ grupo, nombre, etiqueta, tipo, aplica: "vivo", ...extra });

const CATALOGO = [
  // ── Sala (se usan al abrirla) ──
  P("sala", "NombreHost", "Nombre de la sala", "texto", { max: 70, aplica: "reinicio", ayuda: "Lo que se ve en la lista de salas de HaxBall." }),
  P("sala", "CantidadDeJugadores", "Cupo de jugadores", "entero", { min: 2, max: 30, aplica: "reinicio" }),
  P("sala", "VisibilidadDelHost", "Sala pública", "bool", { aplica: "reinicio", ayuda: "Apagado: solo se entra con el link." }),
  P("sala", "PasswordDelHost", "Contraseña de la sala", "texto", { max: 30, nulo: true, aplica: "reinicio", ayuda: "Vacío: sin contraseña." }),
  P("sala", "NombreBot", "Nombre del bot", "texto", { max: 25, aplica: "reinicio" }),
  P("sala", "MapaPorDefecto", "Mapa al abrir", "opciones", { opciones: MAPAS, aplica: "reinicio" }),

  // ── Partido ──
  P("partido", "TiempoDeJuego", "Minutos por partido", "entero", { min: 0, max: 14, ayuda: "0 = sin límite. Se aplica desde el próximo partido." }),
  P("partido", "LimiteDeGoles", "Límite de goles", "entero", { min: 0, max: 14, ayuda: "0 = sin límite. Se aplica desde el próximo partido." }),
  P("partido", "GolDeOroActivado", "Gol de oro", "bool"),
  P("partido", "FairPlayActivado", "Fair play", "bool"),
  P("partido", "powerShotMode", "Disparo potente", "bool"),
  P("partido", "combaMode", "Comba", "bool"),

  // ── Equipos ──
  P("equipos", "ModoDeEquipos", "Modo de equipos", "opciones", {
    opciones: ["config", "ganasigue", "elegir", "combinado"],
    etiquetas: { config: "Según los otros ajustes", ganasigue: "Gana sigue", elegir: "Capitanes eligen", combinado: "Combinado (eligen si sobra gente)" },
    ayuda: "Si no es «Según los otros ajustes», este modo maneja solo los interruptores de abajo.",
  }),
  P("equipos", "maxPlayersPerTeam", "Jugadores por equipo", "entero", { min: 1, max: 7 }),
  P("equipos", "modoJueganTodos", "Juegan todos", "bool"),
  P("equipos", "modoJueganAlgunos", "Juegan algunos (el resto espera)", "bool"),
  P("equipos", "automatizadoActivado", "Modo automático (cambia el mapa según la gente)", "bool"),
  P("equipos", "cambioCami", "Camisetas nuevas en cada partido", "bool"),
  P("equipos", "CamisetasGanaSigue", "El ganador mantiene la camiseta", "bool"),

  // ── Selección por turnos ──
  P("turnos", "SegundosParaElegir", "Segundos para elegir", "entero", { min: 5, max: 120 }),
  P("turnos", "SegundosDeCuenta", "Cuenta regresiva en el chat (segundos)", "entero", { min: 0, max: 10 }),
  P("turnos", "EcharAlQueNoElige", "Echar de la sala al capitán que no elige", "bool", { ayuda: "Apagado: pasa a espectador." }),

  // ── Arranque automático ──
  P("arranque", "AutoArranque", "Arrancar y reanudar solo", "bool"),
  P("arranque", "JugadoresParaArrancar", "Jugadores para arrancar", "entero", { min: 1, max: 14 }),
  P("arranque", "SegundosTrasParar", "Espera después de un Stop (s)", "entero", { min: 1, max: 60 }),
  P("arranque", "SegundosDePausaMaxima", "Pausa máxima (s)", "entero", { min: 3, max: 300 }),
  P("arranque", "SegundosTrasVictoria", "Espera tras un ganador (s)", "entero", { min: 3, max: 60 }),

  // ── Cuentas ──
  P("cuentas", "PedirClaveAUsuarios", "Pedir la clave a los que tienen cuenta", "bool"),
  P("cuentas", "SegundosParaPonerLaClave", "Segundos para poner la clave", "entero", { min: 20, max: 600 }),
  P("cuentas", "SegundosEntrePedidosDeClave", "Recordar la clave cada (s)", "entero", { min: 10, max: 300, aplica: "reinicio" }),
  P("cuentas", "MinutosEntreAvisosDeRegistro", "Invitar a crear cuenta cada (min)", "entero", { min: 1, max: 60, aplica: "reinicio" }),

  // ── Chat ──
  P("chat", "ColorearNombrePorElo", "Color del nombre según la división", "bool"),
  P("chat", "MostrarComandosEnElChat", "Mostrar los comandos en el chat", "bool", { ayuda: "Apagado: nadie ve lo que se escribe con ! (ni las claves)." }),
  P("chat", "Anuncio", "Anuncio de cada partido", "texto", { max: 200 }),
  P("chat", "AvisoDiscordEnElChat", "Invitar al Discord en el chat", "bool", { aplica: "reinicio" }),
  P("chat", "MinutosEntreAvisos", "Invitación al Discord cada (min)", "entero", { min: 1, max: 60, aplica: "reinicio" }),

  // ── Moderación ──
  P("moderacion", "MaximoJugadoresPorIp", "Máximo de jugadores por IP", "entero", { min: 1, max: 10 }),
  P("moderacion", "PorcentajeDeVotosBan", "Votos para expulsar (%)", "entero", { min: 10, max: 100 }),
];

const POR_NOMBRE = new Map(CATALOGO.map((p) => [p.nombre, p]));

// Los comandos que no se pueden apagar: sin !clave nadie con cuenta podría jugar
const COMANDOS_PROTEGIDOS = ["!clave", "!login"];

// ── Salas ──
function salas() {
  return fs.readdirSync(HOSTS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const clave = f.replace(/\.json$/, "");
      let nombre = clave;
      try { nombre = JSON.parse(fs.readFileSync(path.join(HOSTS, f), "utf8")).NombreHost || clave; } catch (e) { /* queda la clave */ }
      return { clave, nombre };
    });
}

function hostDe(sala) {
  try { return JSON.parse(fs.readFileSync(path.join(HOSTS, sala + ".json"), "utf8")); } catch (e) { return {}; }
}

// ── Valores ──
let cacheScript = null;
function textoDelScript() {
  const info = fs.statSync(SCRIPT);
  if (!cacheScript || cacheScript.mtime !== info.mtimeMs) cacheScript = { mtime: info.mtimeMs, texto: fs.readFileSync(SCRIPT, "utf8") };
  return cacheScript.texto;
}

// Lo que trae script.js en la declaración (var X = ...;). undefined si no se puede leer.
function valorEnScript(nombre, texto = textoDelScript()) {
  const m = texto.match(new RegExp(`^[ \\t]*(?:var|let)\\s+${nombre}\\s*=\\s*([^;\\n]+);?`, "m"));
  if (!m) return undefined;
  try { return new Function(`return (${m[1].replace(/\/\/.*$/, "").trim()});`)(); } catch (e) { return undefined; }
}

function valorPorDefecto(sala, nombre) {
  const host = hostDe(sala);
  if (Object.prototype.hasOwnProperty.call(host, nombre)) return host[nombre];
  const enScript = valorEnScript(nombre);
  return enScript === undefined ? null : enScript;
}

// Revisa y normaliza lo que manda el panel. Tira un error entendible si no sirve.
function validar(nombre, valor) {
  const p = POR_NOMBRE.get(nombre);
  if (!p) throw new Error(`"${nombre}" no es un parámetro que se pueda cambiar`);

  if (p.tipo === "bool") {
    if (typeof valor !== "boolean") throw new Error(`${p.etiqueta}: tiene que ser sí o no`);
    return valor;
  }
  if (p.tipo === "entero") {
    const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
    if (!Number.isInteger(n)) throw new Error(`${p.etiqueta}: tiene que ser un número entero`);
    if (n < p.min || n > p.max) throw new Error(`${p.etiqueta}: tiene que estar entre ${p.min} y ${p.max}`);
    return n;
  }
  if (p.tipo === "opciones") {
    if (!p.opciones.includes(valor)) throw new Error(`${p.etiqueta}: opción no válida`);
    return valor;
  }
  // texto
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    if (p.nulo) return null;
    throw new Error(`${p.etiqueta}: no puede quedar vacío`);
  }
  const texto = String(valor).replace(/[\r\n]+/g, " ").trim();
  if (texto.length > p.max) throw new Error(`${p.etiqueta}: máximo ${p.max} caracteres`);
  return texto;
}

// Reemplaza en el texto del script la declaración de cada variable (lo mismo que se hace con
// hosts/<sala>.json al abrir la sala)
function aplicarAlScript(texto, valores) {
  let salida = texto;
  const aplicadas = [];
  for (const [nombre, valor] of Object.entries(valores)) {
    const declaracion = new RegExp(`^([ \\t]*)(var|let|const)\\s+${nombre}\\b[^;\\n]*;?`, "m");
    if (!declaracion.test(salida)) continue;
    salida = salida.replace(declaracion, (_, sangria, palabra) => `${sangria}${palabra} ${nombre} = ${JSON.stringify(valor)};`);
    aplicadas.push(nombre);
  }
  return { texto: salida, aplicadas };
}

// ── Comandos ──
// Todos los "!algo" que aparecen como texto en script.js (del autor y de nuestros bloques).
// Se dejan afuera los números sueltos (!7, que es elegir en el draft).
let cacheComandos = null;
function comandosDelScript() {
  const texto = textoDelScript();
  if (cacheComandos && cacheComandos.texto === texto) return cacheComandos.lista;
  const encontrados = new Set();
  for (const m of texto.matchAll(/["'`](![a-z][a-z0-9_]{1,30})(?=[\s"'`])/gi)) encontrados.add(m[1].toLowerCase());
  const lista = [...encontrados].sort();
  cacheComandos = { texto, lista };
  return lista;
}

module.exports = {
  GRUPOS,
  CATALOGO,
  POR_NOMBRE,
  COMANDOS_PROTEGIDOS,
  salas,
  valorEnScript,
  valorPorDefecto,
  validar,
  aplicarAlScript,
  comandosDelScript,
};
