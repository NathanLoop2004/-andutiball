const express = require("express");
const VistasController = require("../controllers/VistasController");

const router = express.Router();

// ======================== PANTALLAS ========================
// La portada es Ñandutí Web; el panel vive en /frm/panel (con atajo /panel)

router.get("/", VistasController.portada);
router.get("/frm/login", VistasController.login);
router.get("/frm/registro", VistasController.registro);
router.get("/frm/recuperar", VistasController.recuperar);
router.get("/frm/cuenta", VistasController.cuenta);
router.get("/frm/inventario", VistasController.inventario);   // lo que compró cada uno
router.get("/frm/config", VistasController.config);
router.get("/frm/carrusel", VistasController.carrusel);
router.get("/frm/equipos", VistasController.equipos);   // camisetas y clásicos   // OWNER, CO-OWNER, HOSTER, AYUDANTE   // OWNER, CO-OWNER, HOSTER, AYUDANTE
router.get("/frm/camiseta", VistasController.camiseta);       // una camiseta de la tienda
router.get("/frm/animacion", VistasController.animacion);     // una animación de la tienda
router.get("/frm/animaciones", VistasController.animaciones);   // animaciones de gol  ← OWNER y CO-OWNER
router.get("/frm/panel", VistasController.panel);
router.get("/frm/rangos", VistasController.rangos);
router.get("/frm/actualizaciones", VistasController.actualizaciones);
router.get("/frm/usuarios", VistasController.usuarios);   // solo OWNER
router.get("/frm/ajustes", VistasController.ajustes);     // solo OWNER

// Atajos de siempre
router.get("/panel", VistasController.panel);
router.get("/rangos", VistasController.rangos);
router.get("/actualizaciones", VistasController.actualizaciones);

module.exports = router;
