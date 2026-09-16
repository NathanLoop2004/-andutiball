const express = require("express");
const ActualizacionesController = require("../controllers/ActualizacionesController");

const router = express.Router();

// ======================== ACTUALIZACIONES ========================
// Se guardan primero y se mandan al Discord después, a mano.

router.get("/actualizaciones", ActualizacionesController.listar);
router.post("/actualizaciones", ActualizacionesController.crear);
router.post("/actualizaciones/enviar-pendientes", ActualizacionesController.enviarPendientes);
router.post("/actualizaciones/:id/enviar", ActualizacionesController.enviar);
router.delete("/actualizaciones/:id", ActualizacionesController.borrar);

module.exports = router;
