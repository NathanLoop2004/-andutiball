const express = require("express");
const MercadoController = require("../controllers/MercadoController");
const verificarToken = require("../middlewares/verificarToken");

const router = express.Router();

// ======================== EL MERCADO ========================
// La ficha de cada cosa (historial de precios, cuántos la compraron, cuántos favoritos) la
// ve CUALQUIERA: es lo que muestra la página de la camiseta y la de la animación.
// De los favoritos sale solo el número, nunca quiénes son.
// Marcar un favorito pide sesión, y el nick sale del token.

router.get("/mercado/:tipo/:clave", verificarToken({ opcional: true }), MercadoController.ficha);
router.get("/favoritos", verificarToken(), MercadoController.mios);
router.post("/favoritos", verificarToken(), MercadoController.marcar);

module.exports = router;
