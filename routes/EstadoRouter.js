const express = require("express");
const EstadoController = require("../controllers/EstadoController");

const router = express.Router();

// ======================== ESTADO DE LA SALA ========================

router.get("/estado", EstadoController.obtener);

module.exports = router;
