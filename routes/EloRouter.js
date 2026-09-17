const express = require("express");
const EloController = require("../controllers/EloController");

const router = express.Router();

// ======================== ELO ========================

router.get("/elo", EloController.tabla);
router.get("/ranking", EloController.ranking);   // para la web pública: sin el auth de nadie

module.exports = router;
