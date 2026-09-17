const express = require("express");
const AuthController = require("../controllers/AuthController");

const router = express.Router();

// ======================== SESIÓN ========================

router.post("/auth/entrar", AuthController.entrar);
router.post("/auth/registrar/codigo", AuthController.codigoRegistro);
router.post("/auth/registrar", AuthController.registrar);
router.get("/auth/yo", AuthController.yo);

// Recuperar la cuenta por correo
router.post("/auth/recuperar", AuthController.recuperar);
router.get("/auth/recuperar", AuthController.revisarLink);
router.post("/auth/recuperar/cambiar", AuthController.cambiarConLink);

module.exports = router;
