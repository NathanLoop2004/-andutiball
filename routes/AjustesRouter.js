const express = require("express");
const AjustesController = require("../controllers/AjustesController");
const soloOwner = require("../middlewares/soloOwner");

const router = express.Router();

// ======================== AJUSTES DE LA WEB (solo OWNER) ========================

router.get("/ajustes/publicos", AjustesController.publicos);   // lo lee la pantalla de registro
router.get("/ajustes", soloOwner, AjustesController.listar);
router.put("/ajustes/:clave", soloOwner, AjustesController.guardar);

module.exports = router;
