-- Las camisetas de los clubes y los cruces ("clásicos") del cambio automático.
-- Antes estaban escritas a mano en parches/camisetas.js; ahora se editan desde el panel.
CREATE TABLE "equipos" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "division" TEXT,
    "angulo" INTEGER NOT NULL DEFAULT 0,
    "colorTexto" TEXT NOT NULL DEFAULT 'FFFFFF',
    "color1" TEXT NOT NULL,
    "color2" TEXT NOT NULL,
    "color3" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "cambiadoPor" TEXT,
    "cambiado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipos_pkey" PRIMARY KEY ("clave")
);

-- Un clásico: qué camiseta usa el rojo, cuál el azul, y cuánto se repite (la demanda)
CREATE TABLE "clasicos" (
    "id" SERIAL NOT NULL,
    "red" TEXT NOT NULL,
    "blue" TEXT NOT NULL,
    "demanda" INTEGER NOT NULL DEFAULT 300,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cambiadoPor" TEXT,
    "cambiado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clasicos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clasicos_red_blue_key" ON "clasicos"("red", "blue");
CREATE INDEX "clasicos_demanda_idx" ON "clasicos"("demanda");
