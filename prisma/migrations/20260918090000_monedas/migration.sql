-- Monedas de cada cuenta y el historial de movimientos.
-- El saldo se guarda en CENTÉSIMAS (1 moneda = 100) para no arrastrar decimales rotos:
-- una atajada son 30 centésimas (0,30 monedas).
CREATE TABLE "monedas" (
    "nick" TEXT NOT NULL,
    "saldo" INTEGER NOT NULL DEFAULT 0,
    "ganadas" INTEGER NOT NULL DEFAULT 0,
    "gastadas" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monedas_pkey" PRIMARY KEY ("nick")
);

CREATE TABLE "movimientos_monedas" (
    "id" SERIAL NOT NULL,
    "nick" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "sala" TEXT,
    "partidoId" INTEGER,
    "saldoDespues" INTEGER NOT NULL,
    "creado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimientos_monedas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_monedas_nick_creado_idx" ON "movimientos_monedas"("nick", "creado");
