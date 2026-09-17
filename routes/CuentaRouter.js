const express = require("express");
const CuentaController = require("../controllers/CuentaController");
const verificarToken = require("../middlewares/verificarToken");

const router = express.Router();

// ======================== MI CUENTA (con sesión) ========================

router.get("/cuenta", verificarToken(), CuentaController.ficha);
router.post("/cuenta/codigo", verificarToken(), CuentaController.pedirCodigo);
router.post("/cuenta/clave", verificarToken(), CuentaController.cambiarClave);
router.post("/cuenta/email", verificarToken(), CuentaController.ponerEmail);

// Vincular Discord (no es iniciar sesión): ir a autorizar, la vuelta de Discord, y desvincular
router.post("/cuenta/discord", verificarToken(), CuentaController.vincularDiscord);
router.delete("/cuenta/discord", verificarToken(), CuentaController.desvincularDiscord);
router.get("/discord/vuelta", CuentaController.vueltaDiscord);

module.exports = router;
