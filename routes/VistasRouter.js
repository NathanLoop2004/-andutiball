const express = require("express");
const VistasController = require("../controllers/VistasController");

const router = express.Router();

// ======================== PANTALLAS ========================
// La portada es Ñandutí Web; el panel vive en /frm/panel (con atajo /panel)

router.get("/", VistasController.portada);
router.get("/frm/login", VistasController.login);
router.get("/frm/registro", VistasController.registro);
router.get("/frm/panel", VistasController.panel);
router.get("/frm/rangos", VistasController.rangos);
router.get("/frm/actualizaciones", VistasController.actualizaciones);
router.get("/frm/usuarios", VistasController.usuarios);   // solo OWNER

// Atajos de siempre
router.get("/panel", VistasController.panel);
router.get("/rangos", VistasController.rangos);
router.get("/actualizaciones", VistasController.actualizaciones);

module.exports = router;
