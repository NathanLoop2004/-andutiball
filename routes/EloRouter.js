const express = require("express");
const EloController = require("../controllers/EloController");

const router = express.Router();

// ======================== ELO ========================

router.get("/elo", EloController.tabla);

module.exports = router;
