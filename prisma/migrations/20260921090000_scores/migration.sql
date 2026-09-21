-- Los carteles de gol: cómo se ve el aviso con el marcador cuando alguien convierte.

CREATE TABLE "scores" (
    "clave"       TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "plantilla"   TEXT NOT NULL,
    "color"       TEXT NOT NULL DEFAULT 'FFD700',
    "estilo"      TEXT NOT NULL DEFAULT 'bold',
    "sonido"      INTEGER NOT NULL DEFAULT 2,
    "activo"      BOOLEAN NOT NULL DEFAULT true,
    "orden"       INTEGER NOT NULL DEFAULT 0,
    "precio"      INTEGER,
    "enTienda"    BOOLEAN NOT NULL DEFAULT false,
    "detalle"     TEXT,
    "cambiadoPor" TEXT,
    "cambiado"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("clave")
);

CREATE TABLE "scores_comprados" (
    "id"       SERIAL NOT NULL,
    "nick"     TEXT NOT NULL,
    "score"    TEXT NOT NULL,
    "precio"   INTEGER NOT NULL,
    "comprada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_comprados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scores_comprados_nick_score_key" ON "scores_comprados"("nick", "score");
CREATE INDEX "scores_comprados_nick_idx" ON "scores_comprados"("nick");

-- El que tiene puesto cada cuenta
ALTER TABLE "usuarios" ADD COLUMN "score" TEXT;
