// =============================================================================
// MomentosModel — los carteles de los MOMENTOS del partido, que no son goles:
//
//   · "inicio"    cuando arranca (el saque). Nació porque ahí el marcador se pone en 0-0 y
//                 eso se tomaba como gol: salía un "¡GOL! 0 - 0" al empezar.
//   · "victoria"  cuando termina. Reemplaza al "Red is Victorious!" de HaxBall.
//
// No se venden: son CONFIGURACIÓN (panel → Inicio y victoria, solo OWNER y CO-OWNER), y
// queda uno puesto POR MOMENTO.
//
//   catalogo()                todos, para el panel
//   guardar(clave, datos)     crea o cambia uno
//   borrar(clave)             lo saca (si estaba puesto, queda otro puesto)
//   poner(clave)              lo deja como el que se usa (solo uno a la vez)
//   elPuesto()                el que usan las salas, ya armado para mostrar
//   armar(plantilla, datos)   reemplaza los huecos (la usan la sala y la vista previa)
//
// LOS COLORES VAN POR LETRA (`colores`): un color por cada letra del texto YA ARMADO, en el
// mismo orden. Si hay menos colores que letras, las que sobran usan el último. Ojo con esto:
// el chat de HaxBall admite UN SOLO color por mensaje, así que ahí va `color` (el primero);
// las letras de colores se ven en el cartel de la extensión, que es HTML nuestro.
// =============================================================================
const { base } = require("../services/ConexionBase");

const ESTILOS = ["normal", "bold", "small"];
const LARGO_MAXIMO = 240;
const MOMENTOS = ["inicio", "victoria"];

// Los huecos de cada momento, con un ejemplo para la vista previa
const HUECOS_POR_MOMENTO = {
  inicio: [
    { hueco: "{sala}", que: "El nombre de la sala", ejemplo: "ÑandutíHax | Futsal 3v3" },
    { hueco: "{rojo}", que: "La camiseta del equipo rojo", ejemplo: "OLIMPIA" },
    { hueco: "{azul}", que: "La camiseta del equipo azul", ejemplo: "CERRO PORTEÑO" },
    { hueco: "{mapa}", que: "La cancha", ejemplo: "ÑandutíHax Futsal x3" },
    { hueco: "{jugadores}", que: "Cuántos están jugando", ejemplo: "6" },
  ],
  victoria: [
    { hueco: "{ganador}", que: "El equipo que ganó", ejemplo: "OLIMPIA" },
    { hueco: "{perdedor}", que: "El que perdió", ejemplo: "CERRO PORTEÑO" },
    { hueco: "{golesGanador}", que: "Los goles del que ganó", ejemplo: "5" },
    { hueco: "{golesPerdedor}", que: "Los goles del otro", ejemplo: "2" },
    { hueco: "{sala}", que: "El nombre de la sala", ejemplo: "ÑandutíHax | Futsal 3v3" },
  ],
};

const PLANTILLAS_DE_EJEMPLO = {
  inicio: "⚽ ¡ARRANCA EL PARTIDO! {rojo} 🆚 {azul}",
  victoria: "🏆 ¡GANÓ {ganador}! {golesGanador} 🆚 {golesPerdedor} {perdedor}",
};

const elMomento = (m) => (MOMENTOS.includes(String(m)) ? String(m) : "inicio");
const huecosDe = (m) => HUECOS_POR_MOMENTO[elMomento(m)];

// La misma cuenta que hace la sala y la vista previa del panel
function armar(plantilla, datos, momento) {
  let texto = String(plantilla || "");
  for (const { hueco } of huecosDe(momento)) {
    const nombre = hueco.slice(1, -1);
    const valor = datos && datos[nombre] !== undefined && datos[nombre] !== null ? String(datos[nombre]) : "";
    texto = texto.split(hueco).join(valor);
  }
  return texto.replace(/[ \t]{2,}/g, "  ").trim();
}

const ejemplo = (momento) => Object.fromEntries(huecosDe(momento).map((h) => [h.hueco.slice(1, -1), h.ejemplo]));

// Un color por letra, del largo del texto. Sirve para la sala, la web y la extensión.
function coloresDeCadaLetra(texto, colores, color) {
  const base = String(color || "FFD700").replace(/^#/, "").toUpperCase();
  const lista = Array.isArray(colores) ? colores : [];
  const salida = [];
  for (let i = 0; i < String(texto).length; i++) {
    const c = lista[i] || lista[lista.length - 1] || base;
    salida.push(String(c).replace(/^#/, "").toUpperCase());
  }
  return salida;
}

const paraMostrar = (i) => {
  const texto = armar(i.plantilla, ejemplo(i.momento), i.momento);
  return {
    clave: i.clave,
    momento: i.momento,
    nombre: i.nombre,
    descripcion: i.descripcion,
    plantilla: i.plantilla,
    colores: i.colores || [],
    color: i.color,
    estilo: i.estilo,
    sonido: i.sonido,
    puesto: i.puesto,
    ejemplo: texto,
    coloresDelEjemplo: coloresDeCadaLetra(texto, i.colores, i.color),
  };
};

// Deja los datos como corresponde: recorta, valida y nunca tira por un detalle
function limpiar(datos) {
  const nombre = String(datos.nombre || "").trim().slice(0, 40);
  if (!nombre) throw new Error("Ponele un nombre");
  const plantilla = String(datos.plantilla || "").trim().slice(0, LARGO_MAXIMO);
  if (!plantilla) throw new Error("Escribí cómo se ve el cartel");

  const color = String(datos.color || "FFD700").replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(color)) throw new Error("El color tiene que ser de 6 dígitos, como FFD700");

  // Un color por letra: lo que no sea un color se cae al general
  const colores = (Array.isArray(datos.colores) ? datos.colores : [])
    .slice(0, LARGO_MAXIMO)
    .map((c) => {
      const limpio = String(c || "").replace(/^#/, "").toUpperCase();
      return /^[0-9A-F]{6}$/.test(limpio) ? limpio : color;
    });

  return {
    nombre,
    descripcion: String(datos.descripcion || "").trim().slice(0, 200) || null,
    plantilla,
    colores,
    color,
    estilo: ESTILOS.includes(datos.estilo) ? datos.estilo : "bold",
    sonido: [0, 1, 2].includes(Number(datos.sonido)) ? Number(datos.sonido) : 2,
  };
}

class MomentosModel {
  static get MOMENTOS() { return MOMENTOS; }
  static get LARGO_MAXIMO() { return LARGO_MAXIMO; }
  static huecos(momento) { return huecosDe(momento); }
  static plantillaDeEjemplo(momento) { return PLANTILLAS_DE_EJEMPLO[elMomento(momento)]; }
  static armar(plantilla, datos, momento) { return armar(plantilla, datos, momento); }
  static coloresDeCadaLetra(texto, colores, color) { return coloresDeCadaLetra(texto, colores, color); }

  // Todos los de un momento (o todos, si no se pide ninguno)
  static async catalogo(momento) {
    const filas = await base().cartelMomento.findMany({
      where: momento ? { momento: elMomento(momento) } : undefined,
      orderBy: [{ momento: "asc" }, { puesto: "desc" }, { nombre: "asc" }],
    });
    return filas.map(paraMostrar);
  }

  static async guardar(clave, datos, quien) {
    const limpios = limpiar(datos);
    const momento = elMomento(datos.momento);
    const llave = String(clave || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(llave)) throw new Error("Esa clave no sirve");

    const fila = await base().cartelMomento.upsert({
      where: { clave: llave },
      create: { clave: llave, momento, ...limpios, cambiadoPor: quien || null },
      update: { momento, ...limpios, cambiadoPor: quien || null, cambiado: new Date() },
    });
    return paraMostrar(fila);
  }

  static async borrar(clave) {
    const llave = String(clave || "").trim().toLowerCase();
    const fila = await base().cartelMomento.findUnique({ where: { clave: llave } });
    if (!fila) throw new Error("Ese cartel no existe");
    await base().cartelMomento.delete({ where: { clave: llave } });

    // Si el que se fue era el puesto, queda puesto otro del MISMO momento: así nunca se
    // quedan las salas sin cartel de arranque (o de victoria) por borrar uno.
    if (fila.puesto) {
      const otro = await base().cartelMomento.findFirst({
        where: { momento: fila.momento }, orderBy: { nombre: "asc" },
      });
      if (otro) await base().cartelMomento.update({ where: { clave: otro.clave }, data: { puesto: true } });
    }
    return { ok: true };
  }

  // Uno puesto POR MOMENTO: se bajan los de ese momento y se sube el elegido
  static async poner(clave) {
    const llave = String(clave || "").trim().toLowerCase();
    const fila = await base().cartelMomento.findUnique({ where: { clave: llave } });
    if (!fila) throw new Error("Ese cartel no existe");
    await base().cartelMomento.updateMany({
      where: { momento: fila.momento, puesto: true }, data: { puesto: false },
    });
    const puesto = await base().cartelMomento.update({ where: { clave: llave }, data: { puesto: true } });
    return paraMostrar(puesto);
  }

  // El que usan las salas (y la extensión). Sin base o sin ninguno devuelve null y la sala
  // simplemente no anuncia nada: nunca se rompe por esto.
  static async elPuesto(momento) {
    const fila = await base().cartelMomento.findFirst({
      where: { momento: elMomento(momento), puesto: true },
    });
    return fila ? paraMostrar(fila) : null;
  }
}

module.exports = MomentosModel;
