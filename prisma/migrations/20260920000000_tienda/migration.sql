-- La tienda de camisetas: se le pone precio a un equipo que ya existe y la gente la compra
-- con sus monedas. El precio va en CENTÉSIMAS, igual que el saldo (1 moneda = 100).
ALTER TABLE "equipos" ADD COLUMN "precio" INTEGER;
ALTER TABLE "equipos" ADD COLUMN "enTienda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "equipos" ADD COLUMN "detalle" TEXT;

-- Qué camisetas tiene cada cuenta (cada fila es una compra)
CREATE TABLE "camisetas_compradas" (
    "id" SERIAL NOT NULL,
    "nick" TEXT NOT NULL,
    "equipo" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "comprada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "camisetas_compradas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "camisetas_compradas_nick_equipo_key" ON "camisetas_compradas"("nick", "equipo");
CREATE INDEX "camisetas_compradas_nick_idx" ON "camisetas_compradas"("nick");

-- La que tiene puesta (de las que compró)
ALTER TABLE "usuarios" ADD COLUMN "camiseta" TEXT;
