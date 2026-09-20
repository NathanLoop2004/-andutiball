-- Las rachas de cada cuenta: cuántas viene ganando seguidas y cuál fue su mejor racha.
CREATE TABLE "rachas" (
    "nick" TEXT NOT NULL,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "mejor" INTEGER NOT NULL DEFAULT 0,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "ultimoResultado" TEXT,
    "mejorCuando" TIMESTAMP(3),
    "actualizada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rachas_pkey" PRIMARY KEY ("nick")
);

CREATE INDEX "rachas_mejor_idx" ON "rachas"("mejor" DESC);
CREATE INDEX "rachas_actual_idx" ON "rachas"("actual" DESC);
