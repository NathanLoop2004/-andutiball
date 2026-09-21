const express = require("express");
const MomentosController = require("../controllers/MomentosController");
const puedeVerRangos = require("../middlewares/puedeVerRangos");

const router = express.Router();

// ============ CARTELES DEL PARTIDO: ARRANQUE Y VICTORIA ============
// El que sale cuando empieza (que no es un gol) y el que reemplaza al "Red is Victorious!".
// Son configuración: los ven y los tocan SOLO el OWNER y el CO-OWNER. Lo que necesita la
// extensión sale por /api/publico/salas, que es público y de solo lectura.

router.get("/momentos/:momento", puedeVerRangos, MomentosController.catalogo);
router.put("/momentos/:momento/:clave", puedeVerRangos, MomentosController.guardar);
router.delete("/momentos/:momento/:clave", puedeVerRangos, MomentosController.borrar);
router.post("/momentos/:momento/:clave/poner", puedeVerRangos, MomentosController.poner);

module.exports = router;
