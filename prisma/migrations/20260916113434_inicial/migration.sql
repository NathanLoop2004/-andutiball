-- CreateTable
CREATE TABLE "jugadores" (
    "id" SERIAL NOT NULL,
    "auth" TEXT,
    "nick" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "asistencias" INTEGER NOT NULL DEFAULT 0,
    "creado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visto" TIMESTAMP(3) NOT NULL,
    "rangoId" INTEGER,

    CONSTRAINT "jugadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salas" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "partidos" (
    "id" SERIAL NOT NULL,
    "salaClave" TEXT,
    "mapa" TEXT,
    "golesRed" INTEGER NOT NULL DEFAULT 0,
    "golesBlue" INTEGER NOT NULL DEFAULT 0,
    "ganador" INTEGER,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),

    CONSTRAINT "partidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participaciones" (
    "id" SERIAL NOT NULL,
    "partidoId" INTEGER NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "equipo" INTEGER NOT NULL,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "asistencias" INTEGER NOT NULL DEFAULT 0,
    "eloAntes" INTEGER,
    "eloDespues" INTEGER,

    CONSTRAINT "participaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rangos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "nicks" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "rangos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_auth_key" ON "jugadores"("auth");

-- CreateIndex
CREATE INDEX "jugadores_nick_idx" ON "jugadores"("nick");

-- CreateIndex
CREATE INDEX "partidos_inicio_idx" ON "partidos"("inicio");

-- CreateIndex
CREATE UNIQUE INDEX "participaciones_partidoId_jugadorId_key" ON "participaciones"("partidoId", "jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "rangos_nombre_key" ON "rangos"("nombre");

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_rangoId_fkey" FOREIGN KEY ("rangoId") REFERENCES "rangos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_salaClave_fkey" FOREIGN KEY ("salaClave") REFERENCES "salas"("clave") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "partidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones" ADD CONSTRAINT "participaciones_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
