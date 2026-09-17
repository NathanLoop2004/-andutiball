-- Parámetros de juego por sala y comandos apagados, editables desde el panel
CREATE TABLE "parametros_sala" (
    "id" SERIAL NOT NULL,
    "sala" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "cambiadoPor" TEXT,
    "cambiado" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parametros_sala_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parametros_sala_sala_nombre_key" ON "parametros_sala"("sala", "nombre");

CREATE TABLE "comandos_apagados" (
    "id" SERIAL NOT NULL,
    "sala" TEXT NOT NULL,
    "comando" TEXT NOT NULL,
    "apagadoPor" TEXT,
    "apagado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comandos_apagados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "comandos_apagados_sala_comando_key" ON "comandos_apagados"("sala", "comando");
