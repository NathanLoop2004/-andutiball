-- Animaciones de gol: se arman desde el panel y se venden como las camisetas.

CREATE TABLE "animaciones" (
    "clave"       TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo"        TEXT NOT NULL DEFAULT 'secuencia',
    "cuadros"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "msPorCuadro" INTEGER NOT NULL DEFAULT 200,
    "tamanoDesde" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "tamanoHasta" DOUBLE PRECISION NOT NULL DEFAULT 1.6,
    "duracionMs"  INTEGER NOT NULL DEFAULT 3000,
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "orden"       INTEGER NOT NULL DEFAULT 0,
    "precio"      INTEGER,
    "enTienda"    BOOLEAN NOT NULL DEFAULT false,
    "detalle"     TEXT,
    "cambiadoPor" TEXT,
    "cambiado"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animaciones_pkey" PRIMARY KEY ("clave")
);

CREATE TABLE "animaciones_compradas" (
    "id"        SERIAL NOT NULL,
    "nick"      TEXT NOT NULL,
    "animacion" TEXT NOT NULL,
    "precio"    INTEGER NOT NULL,
    "comprada"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animaciones_compradas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "animaciones_compradas_nick_animacion_key" ON "animaciones_compradas"("nick", "animacion");
CREATE INDEX "animaciones_compradas_nick_idx" ON "animaciones_compradas"("nick");

-- La que tiene puesta cada cuenta
ALTER TABLE "usuarios" ADD COLUMN "animacion" TEXT;
