const express = require("express");
const ModeracionController = require("../controllers/ModeracionController");
const puedeModerar = require("../middlewares/puedeModerar");

const router = express.Router();

// ======================== KICK Y BAN ========================
// Sin clave de sala: la sala local (launcher). Con clave: el panel reenvía a esa sala.
// Expulsar: OWNER, CO-OWNER, HOSTER y AYUDANTE. Banear: todos esos menos el AYUDANTE.

router.post("/kick", puedeModerar(), ModeracionController.kick);
router.post("/kick/:sala", puedeModerar(), ModeracionController.kick);
router.post("/ban", puedeModerar({ banear: true }), ModeracionController.ban);
router.post("/ban/:sala", puedeModerar({ banear: true }), ModeracionController.ban);

module.exports = router;
