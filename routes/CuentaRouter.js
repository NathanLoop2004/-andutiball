const express = require("express");
const CuentaController = require("../controllers/CuentaController");
const verificarToken = require("../middlewares/verificarToken");

const router = express.Router();

// ======================== MI CUENTA (con sesión) ========================

router.get("/cuenta", verificarToken(), CuentaController.ficha);
router.post("/cuenta/codigo", verificarToken(), CuentaController.pedirCodigo);
router.post("/cuenta/clave", verificarToken(), CuentaController.cambiarClave);
router.post("/cuenta/email", verificarToken(), CuentaController.ponerEmail);

module.exports = router;
