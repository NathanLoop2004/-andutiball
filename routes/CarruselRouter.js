const express = require("express");
const CarruselController = require("../controllers/CarruselController");
const puedeConfigurar = require("../middlewares/puedeConfigurar");
const CarruselModel = require("../models/CarruselModel");

const router = express.Router();

// La imagen llega tal cual en el cuerpo (no como JSON): hasta 3 MB, solo tipos de imagen
const cuerpoImagen = express.raw({ type: ["image/*", "application/octet-stream"], limit: CarruselModel.MAX_BYTES + 1024 });

// El error de "muy grande" de express.raw, en castellano
const tamanoMaximo = (error, req, res, next) => {
  if (error && error.type === "entity.too.large") return res.status(413).json({ ok: false, error: "La imagen pesa más de 3 MB" });
  next(error);
};

// ======================== CARRUSEL ========================

// Públicas: las usa la portada
router.get("/carrusel", CarruselController.publicas);
router.get("/carrusel/:id/imagen", CarruselController.imagen);

// Panel: OWNER, CO-OWNER, HOSTER y AYUDANTE
router.get("/carrusel/todas", puedeConfigurar, CarruselController.todas);
router.post("/carrusel", puedeConfigurar, cuerpoImagen, tamanoMaximo, CarruselController.subir);
router.post("/carrusel/orden", puedeConfigurar, CarruselController.ordenar);
router.put("/carrusel/:id", puedeConfigurar, CarruselController.editar);
router.delete("/carrusel/:id", puedeConfigurar, CarruselController.borrar);

module.exports = router;
