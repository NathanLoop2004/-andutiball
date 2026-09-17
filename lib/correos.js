// ¿Ese correo puede existir? — lo que se puede revisar al instante, sin mandar nada.
//
// Ningún servidor contesta "sí, esa casilla existe" (Gmail no lo dice, por los spammers). Lo que sí
// se puede mirar:
//   1. que esté bien escrito;
//   2. si es Gmail, que el nombre cumpla sus reglas (6 a 30 letras, números y puntos);
//   3. que el dominio exista y reciba correo (registro MX en el DNS): "juan@gmial.com" no pasa.
// La prueba de verdad es el código que se manda al registrarse (models/RegistroModel.js).

const dns = require("dns").promises;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GMAIL = new Set(["gmail.com", "googlemail.com"]);

let resolverDePrueba = null;   // las pruebas lo cambian para no depender de internet

const limpiar = (email) => String(email == null ? "" : email).trim().toLowerCase();

// Las reglas de Gmail para el nombre (lo de antes de @). Lo de después de un "+" es libre.
function gmailValido(nombre) {
  const base = nombre.split("+")[0];
  if (!/^[a-z0-9.]+$/.test(base)) return false;
  if (base.startsWith(".") || base.endsWith(".") || base.includes("..")) return false;
  const letras = base.replace(/\./g, "").length;
  return letras >= 6 && letras <= 30;
}

// true: recibe correo · false: seguro que no · null: no se pudo saber (sin internet, DNS lento)
async function dominioRecibeCorreo(dominio) {
  const resolver = resolverDePrueba || ((d) => dns.resolveMx(d));
  try {
    const mx = await Promise.race([
      resolver(dominio),
      new Promise((_, no) => setTimeout(() => no(Object.assign(new Error("tardó"), { code: "ETIMEOUT" })), 5000)),
    ]);
    return Array.isArray(mx) && mx.some((m) => m && m.exchange);
  } catch (error) {
    if (["ENOTFOUND", "ENODATA", "ENOTIMP", "ESERVFAIL"].includes(error.code)) return false;
    return null;
  }
}

// Tira un error con un mensaje para la persona si el correo seguro no existe. Devuelve el correo limpio.
async function revisarQueExista(email) {
  const correo = limpiar(email);
  if (!correo) throw new Error("Falta el correo electrónico");
  if (correo.length > 200 || !EMAIL_VALIDO.test(correo)) throw new Error("Ese correo no es válido");
  const [nombre, dominio] = correo.split("@");
  if (GMAIL.has(dominio)) {
    if (!gmailValido(nombre)) throw new Error("Ese Gmail no existe. Revisá cómo lo escribiste.");
    return correo;   // gmail.com recibe correo seguro: no hace falta preguntar al DNS
  }
  const recibe = await dominioRecibeCorreo(dominio);
  if (recibe === false) throw new Error(`Ese correo no existe: "${dominio}" no recibe correos. Revisá cómo lo escribiste.`);
  return correo;
}

module.exports = {
  revisarQueExista,
  gmailValido,
  dominioRecibeCorreo,
  usarResolver: (fn) => { resolverDePrueba = fn || null; },
};
