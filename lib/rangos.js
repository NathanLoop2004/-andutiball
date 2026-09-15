// Lee y guarda roles.json: los rangos (OWNER, CO-OWNER, ...) y la clave que piden al entrar.

const fs = require("fs");
const path = require("path");

const ARCHIVO = process.env.ROLES_FILE || path.join(__dirname, "..", "roles.json");

const VACIO = { clave: "", roles: [] };

function leerRangos() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
    return {
      clave: typeof datos.clave === "string" ? datos.clave : "",
      roles: Array.isArray(datos.roles)
        ? datos.roles.map((r, i) => ({
            id: r.id || `rol${i + 1}`,
            nombre: String(r.nombre || `ROL ${i + 1}`),
            admin: Boolean(r.admin),
            nicks: Array.isArray(r.nicks) ? r.nicks.map(String).filter(Boolean) : [],
          }))
        : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") console.error("⚠️ roles.json no se pudo leer:", error.message);
    return { ...VACIO };
  }
}

function guardarRangos(datos) {
  const limpio = {
    clave: typeof datos.clave === "string" ? datos.clave : "",
    roles: (Array.isArray(datos.roles) ? datos.roles : []).map((r, i) => ({
      id: r.id || `rol${i + 1}`,
      nombre: String(r.nombre || `ROL ${i + 1}`).slice(0, 60),
      admin: Boolean(r.admin),
      nicks: [...new Set((Array.isArray(r.nicks) ? r.nicks : []).map((n) => String(n).trim()).filter(Boolean))],
    })),
  };
  fs.writeFileSync(ARCHIVO, JSON.stringify(limpio, null, 2) + "\n");
  return limpio;
}

// Nunca mandamos la clave al navegador: solo decimos si hay una puesta
function sinClave(datos) {
  return { ...datos, clave: undefined, tieneClave: Boolean(datos.clave) };
}

module.exports = { ARCHIVO, leerRangos, guardarRangos, sinClave };
