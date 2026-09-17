const express = require("express");
const RangosController = require("../controllers/RangosController");
const puedeVerRangos = require("../middlewares/puedeVerRangos");

const router = express.Router();

// ======================== RANGOS (solo OWNER y CO-OWNER) ========================

router.get("/rangos", puedeVerRangos, RangosController.listar);
router.post("/rangos", puedeVerRangos, RangosController.guardar);
router.get("/rangos/usuarios", puedeVerRangos, RangosController.usuarios);   // ?q= para buscar

module.exports = router;
