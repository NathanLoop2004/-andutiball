const express = require("express");
const SalasController = require("../controllers/SalasController");

const router = express.Router();

// ======================== SALAS ========================

router.get("/salas", SalasController.listar);

module.exports = router;
