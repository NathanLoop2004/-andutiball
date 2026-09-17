const express = require("express");
const ConfigController = require("../controllers/ConfigController");
const puedeConfigurar = require("../middlewares/puedeConfigurar");

const router = express.Router();

// ======================== CONFIGURACIÓN (OWNER, CO-OWNER, HOSTER, AYUDANTE) ========================

router.get("/config/salas", puedeConfigurar, ConfigController.salas);
router.get("/config/:sala/parametros", puedeConfigurar, ConfigController.parametros);
router.put("/config/:sala/parametros/:nombre", puedeConfigurar, ConfigController.guardarParametro);
router.delete("/config/:sala/parametros/:nombre", puedeConfigurar, ConfigController.restablecerParametro);
router.get("/config/:sala/comandos", puedeConfigurar, ConfigController.comandos);
router.post("/config/:sala/comandos", puedeConfigurar, ConfigController.cambiarComando);

module.exports = router;
