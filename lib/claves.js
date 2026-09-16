// Claves de los usuarios. La clave NUNCA se guarda tal cual: se guarda un hash.
//
// Usa scrypt, que viene con Node — nada de dependencias nuevas. El formato guardado es
// "scrypt$<sal>$<hash>": la sal es distinta para cada usuario, así dos personas con la
// misma clave no tienen el mismo hash.

const crypto = require("crypto");

const LARGO_MINIMO = 4;
const LARGO_MAXIMO = 60;
const BYTES = 32;

function revisarClave(clave) {
  const texto = String(clave == null ? "" : clave);
  if (texto.trim().length < LARGO_MINIMO) throw new Error(`La clave necesita al menos ${LARGO_MINIMO} caracteres`);
  if (texto.length > LARGO_MAXIMO) throw new Error(`La clave no puede pasar de ${LARGO_MAXIMO} caracteres`);
  return texto;
}

function hashear(clave) {
  const texto = revisarClave(clave);
  const sal = crypto.randomBytes(16).toString("hex");
  return `scrypt$${sal}$${crypto.scryptSync(texto, sal, BYTES).toString("hex")}`;
}

// Nunca tira: una clave mal escrita o un hash roto son simplemente "no"
function verificar(clave, guardado) {
  try {
    const [tipo, sal, hash] = String(guardado || "").split("$");
    if (tipo !== "scrypt" || !sal || !hash) return false;
    const prueba = crypto.scryptSync(String(clave == null ? "" : clave), sal, BYTES);
    const esperado = Buffer.from(hash, "hex");
    if (prueba.length !== esperado.length) return false;
    return crypto.timingSafeEqual(prueba, esperado);
  } catch (error) {
    return false;
  }
}

module.exports = { hashear, verificar, revisarClave, LARGO_MINIMO, LARGO_MAXIMO };
