-- Las ligas de las camisetas, para poder agruparlas y crear las que hagan falta.

CREATE TABLE "ligas" (
    "clave"       TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "pais"        TEXT,
    "color"       TEXT NOT NULL DEFAULT '2563EB',
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "orden"       INTEGER NOT NULL DEFAULT 0,
    "cambiadoPor" TEXT,
    "cambiado"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ligas_pkey" PRIMARY KEY ("clave")
);

ALTER TABLE "equipos" ADD COLUMN "liga" TEXT;

-- "division" era texto libre y estaba vacío en las 29 camisetas: nunca se usó.
-- Por si alguna tuviera algo, se pasa a la liga antes de sacarlo.
UPDATE "equipos" SET "liga" = lower(regexp_replace("division", '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE "division" IS NOT NULL AND "division" <> '';
INSERT INTO "ligas" ("clave", "nombre")
  SELECT DISTINCT "liga", upper("division") FROM "equipos" WHERE "liga" IS NOT NULL
  ON CONFLICT ("clave") DO NOTHING;

ALTER TABLE "equipos" DROP COLUMN "division";
