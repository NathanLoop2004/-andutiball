const express = require("express");
const TiendaController = require("../controllers/TiendaController");
const verificarToken = require("../middlewares/verificarToken");
const puedeVerRangos = require("../middlewares/puedeVerRangos");

const router = express.Router();

// ======================== TIENDA DE CAMISETAS ========================
// La vitrina la ve cualquiera (es el carrusel de la portada).
// Comprar y elegir piden sesión. Los precios los ponen SOLO OWNER y CO-OWNER.

router.get("/tienda", TiendaController.vitrina);
router.get("/tienda/mias", verificarToken(), TiendaController.mias);
router.post("/tienda/comprar", verificarToken(), TiendaController.comprar);
router.post("/tienda/vender", verificarToken(), TiendaController.vender);
router.post("/tienda/elegir", verificarToken(), TiendaController.elegir);

router.get("/tienda/panel", puedeVerRangos, TiendaController.paraElPanel);
router.put("/tienda/:clave", puedeVerRangos, TiendaController.ponerPrecio);

module.exports = router;
