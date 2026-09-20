-- El historial de precios y los favoritos, para las dos tiendas.

CREATE TABLE "precios_historial" (
    "id"     SERIAL NOT NULL,
    "tipo"   TEXT NOT NULL,
    "clave"  TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "quien"  TEXT,
    "cuando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precios_historial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "precios_historial_tipo_clave_cuando_idx" ON "precios_historial"("tipo", "clave", "cuando");

CREATE TABLE "favoritos" (
    "id"     SERIAL NOT NULL,
    "nick"   TEXT NOT NULL,
    "tipo"   TEXT NOT NULL,
    "clave"  TEXT NOT NULL,
    "cuando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoritos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "favoritos_nick_tipo_clave_key" ON "favoritos"("nick", "tipo", "clave");
CREATE INDEX "favoritos_tipo_clave_idx" ON "favoritos"("tipo", "clave");

-- Los precios que ya existen entran como primer punto del historial, para que no arranque vacío
INSERT INTO "precios_historial" ("tipo", "clave", "precio", "quien", "cuando")
SELECT 'camiseta', "clave", "precio", "cambiadoPor", "cambiado" FROM "equipos" WHERE "precio" IS NOT NULL;
INSERT INTO "precios_historial" ("tipo", "clave", "precio", "quien", "cuando")
SELECT 'animacion', "clave", "precio", "cambiadoPor", "cambiado" FROM "animaciones" WHERE "precio" IS NOT NULL;
