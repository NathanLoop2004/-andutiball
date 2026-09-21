const express = require("express");
const ScoresController = require("../controllers/ScoresController");
const verificarToken = require("../middlewares/verificarToken");
const puedeVerRangos = require("../middlewares/puedeVerRangos");

const router = express.Router();

// ======================== CARTELES DE GOL ========================
// La vitrina la ve cualquiera. Comprar, vender y elegir piden sesión.
// Armarlos y ponerles precio es SOLO de OWNER y CO-OWNER.

router.get("/scores", ScoresController.vitrina);
router.get("/scores/mios", verificarToken(), ScoresController.mios);
router.post("/scores/comprar", verificarToken(), ScoresController.comprar);
router.post("/scores/vender", verificarToken(), ScoresController.vender);
router.post("/scores/elegir", verificarToken(), ScoresController.elegir);

router.get("/scores/panel", puedeVerRangos, ScoresController.catalogo);
router.put("/scores/:clave", puedeVerRangos, ScoresController.guardar);
router.delete("/scores/:clave", puedeVerRangos, ScoresController.borrar);

module.exports = router;
