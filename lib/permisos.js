// Quién puede hacer qué, según el nombre del rango.
//
// Los rangos de la tabla traen emojis y adornos ("🗦👑🗧 OWNER", "🤝 CO-OWNER"), así que se
// compara solo la palabra: letras y guiones, en mayúsculas. Así "🔧 SUBAYUDANTE" NO cuenta
// como "AYUDANTE" (antes se comparaba el nombre entero y el OWNER de verdad no era OWNER).

const palabraDelRango = (nombre) =>
  String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z-]/g, "")
    .replace(/^-+|-+$/g, "");

// Los que pueden cambiar los parámetros de las salas y apagar comandos (el AYUDANTE también).
// Lo único que el AYUDANTE no puede es banear (ver RANGOS_BANEAR).
const RANGOS_CONFIG = ["OWNER", "CO-OWNER", "HOSTER", "AYUDANTE"];
// Los que pueden ver y cambiar los rangos (quién es admin)
const RANGOS_RANGOS = ["OWNER", "CO-OWNER"];
// Los que ven las salas (quién está conectado) y pueden EXPULSAR. El AYUDANTE llega hasta acá.
const RANGOS_MODERAR = ["OWNER", "CO-OWNER", "HOSTER", "AYUDANTE"];
// Los que además pueden BANEAR (el ban deja a alguien afuera hasta que se reinicie la sala)
const RANGOS_BANEAR = ["OWNER", "CO-OWNER", "HOSTER"];

const esRango = (rango, lista) => Boolean(rango && lista.includes(palabraDelRango(rango.nombre)));
const esOwner = (rango) => esRango(rango, ["OWNER"]);
const puedeConfigurar = (rango) => esRango(rango, RANGOS_CONFIG);
const puedeVerRangos = (rango) => esRango(rango, RANGOS_RANGOS);
const puedeExpulsar = (rango) => esRango(rango, RANGOS_MODERAR);
const puedeBanear = (rango) => esRango(rango, RANGOS_BANEAR);

module.exports = {
  palabraDelRango, esRango, esOwner, puedeConfigurar, puedeVerRangos, puedeExpulsar, puedeBanear,
  RANGOS_CONFIG, RANGOS_RANGOS, RANGOS_MODERAR, RANGOS_BANEAR,
};
