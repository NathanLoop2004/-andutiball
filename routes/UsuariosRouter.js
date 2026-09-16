const express = require("express");
const UsuariosController = require("../controllers/UsuariosController");
const soloOwner = require("../middlewares/soloOwner");

const router = express.Router();

// ======================== USUARIOS (solo OWNER) ========================

router.get("/usuarios", soloOwner, UsuariosController.listar);
router.post("/usuarios/:nick/banear", soloOwner, UsuariosController.banear);
router.post("/usuarios/:nick/desbanear", soloOwner, UsuariosController.desbanear);
router.post("/usuarios/:nick/clave", soloOwner, UsuariosController.ponerClave);

module.exports = router;
