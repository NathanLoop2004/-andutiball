const express = require("express");
const EquiposController = require("../controllers/EquiposController");
const puedeConfigurar = require("../middlewares/puedeConfigurar");

const router = express.Router();

// ======================== EQUIPOS Y CLÁSICOS (OWNER, CO-OWNER, HOSTER, AYUDANTE) ========================

router.get("/equipos", puedeConfigurar, EquiposController.listar);
router.post("/equipos", puedeConfigurar, EquiposController.crear);
router.put("/equipos/:clave", puedeConfigurar, EquiposController.guardar);
router.delete("/equipos/:clave", puedeConfigurar, EquiposController.borrar);
// Las ligas: agrupan las camisetas (Primera, Intermedia, selecciones…)
router.post("/equipos/ligas", puedeConfigurar, EquiposController.guardarLiga);
router.delete("/equipos/ligas/:clave", puedeConfigurar, EquiposController.borrarLiga);
router.post("/equipos/poner-liga", puedeConfigurar, EquiposController.ponerLiga);

router.post("/equipos/clasicos", puedeConfigurar, EquiposController.guardarClasico);
router.delete("/equipos/clasicos/:id", puedeConfigurar, EquiposController.borrarClasico);

module.exports = router;
