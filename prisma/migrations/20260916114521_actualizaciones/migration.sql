-- CreateTable
CREATE TABLE "actualizaciones" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT,
    "mensaje" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "commit" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "error" TEXT,
    "creada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada" TIMESTAMP(3),

    CONSTRAINT "actualizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actualizaciones_estado_creada_idx" ON "actualizaciones"("estado", "creada");
