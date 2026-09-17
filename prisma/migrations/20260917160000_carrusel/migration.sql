-- Imágenes del carrusel de la portada (la imagen se guarda en la base)
CREATE TABLE "imagenes_carrusel" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT,
    "descripcion" TEXT,
    "enlace" TEXT,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "subidaPor" TEXT,
    "creada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cambiada" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "imagenes_carrusel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "imagenes_carrusel_activa_orden_idx" ON "imagenes_carrusel"("activa", "orden");
