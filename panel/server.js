// Servidor del panel: junta las 4 salas en una sola pantalla (http://localhost:8080).
//
// Es solo el arranque: las rutas están en routes/, la lógica en controllers/ y
// models/, y las pantallas en views/ (ver app.js).
//
// SALAS: lista "clave|nombre|url" separada por comas.
// Ej: SALAS="3v3|3v3|http://host-3v3:3000,4v4|4v4|http://host-4v4:3000"

const { crearApp } = require("../app");
const SalasModel = require("../models/SalasModel");

const PUERTO = Number(process.env.PANEL_PORT || 8080);
const SALAS = SalasModel.desdeTexto(process.env.SALAS || "local|Sala local|http://localhost:3000");

const app = crearApp({ salas: SALAS });

app.listen(PUERTO, () => {
  console.log(`🖥️  Panel en http://localhost:${PUERTO}`);
  console.log(`   Salas: ${SALAS.map((s) => `${s.nombre} → ${s.url}`).join(" | ")}`);
});
