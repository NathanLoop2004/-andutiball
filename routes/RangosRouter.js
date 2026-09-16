const express = require("express");
const RangosController = require("../controllers/RangosController");

const router = express.Router();

// ======================== RANGOS ========================

router.get("/rangos", RangosController.listar);
router.post("/rangos", RangosController.guardar);

module.exports = router;
