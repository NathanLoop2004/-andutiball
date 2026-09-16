const express = require("express");
const AuthController = require("../controllers/AuthController");

const router = express.Router();

// ======================== SESIÓN ========================

router.post("/auth/entrar", AuthController.entrar);
router.post("/auth/registrar", AuthController.registrar);
router.get("/auth/yo", AuthController.yo);

module.exports = router;
