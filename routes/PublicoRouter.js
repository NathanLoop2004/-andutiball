const express = require("express");
const PublicoController = require("../controllers/PublicoController");

const router = express.Router();

// ======================== LO PÚBLICO DE LAS SALAS ========================
// Sin sesión y con CORS abierto: lo lee la extensión de ÑandutíHax desde haxball.com.
// Devuelve SOLO el marcador y quién está jugando (ver models/PublicoModel.js).

router.get("/publico/salas", PublicoController.salas);

module.exports = router;
