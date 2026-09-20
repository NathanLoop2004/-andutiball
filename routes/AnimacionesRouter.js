const express = require("express");
const AnimacionesController = require("../controllers/AnimacionesController");
const verificarToken = require("../middlewares/verificarToken");
const puedeVerRangos = require("../middlewares/puedeVerRangos");

const router = express.Router();

// ======================== ANIMACIONES DE GOL ========================
// La vitrina la ve cualquiera. Comprar, vender y elegir piden sesión.
// El catálogo (armar animaciones nuevas y ponerles precio) es SOLO de OWNER y CO-OWNER.

router.get("/animaciones", AnimacionesController.vitrina);
router.get("/animaciones/mias", verificarToken(), AnimacionesController.mias);
router.post("/animaciones/comprar", verificarToken(), AnimacionesController.comprar);
router.post("/animaciones/vender", verificarToken(), AnimacionesController.vender);
router.post("/animaciones/elegir", verificarToken(), AnimacionesController.elegir);

router.get("/animaciones/panel", puedeVerRangos, AnimacionesController.catalogo);
router.put("/animaciones/:clave", puedeVerRangos, AnimacionesController.guardar);
router.delete("/animaciones/:clave", puedeVerRangos, AnimacionesController.borrar);

module.exports = router;
