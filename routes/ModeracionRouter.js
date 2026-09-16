const express = require("express");
const ModeracionController = require("../controllers/ModeracionController");

const router = express.Router();

// ======================== KICK Y BAN ========================
// Sin clave de sala: la sala local (launcher). Con clave: el panel reenvía a esa sala.

router.post("/kick", ModeracionController.kick);
router.post("/kick/:sala", ModeracionController.kick);
router.post("/ban", ModeracionController.ban);
router.post("/ban/:sala", ModeracionController.ban);

module.exports = router;
