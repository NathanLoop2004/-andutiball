-- ELO: una tabla por sala y una general. El general lo calcula actualizar_elo_general().

CREATE TABLE "elo_3v3" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elo_3v3_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "elo_3v3_elo_idx" ON "elo_3v3"("elo");

CREATE TABLE "elo_4v4" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elo_4v4_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "elo_4v4_elo_idx" ON "elo_4v4"("elo");

CREATE TABLE "elo_todos" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elo_todos_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "elo_todos_elo_idx" ON "elo_todos"("elo");

CREATE TABLE "elo_realsoccer" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elo_realsoccer_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "elo_realsoccer_elo_idx" ON "elo_realsoccer"("elo");

CREATE TABLE "elo_general" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "partidos" INTEGER NOT NULL DEFAULT 0,
    "ganados" INTEGER NOT NULL DEFAULT 0,
    "empatados" INTEGER NOT NULL DEFAULT 0,
    "perdidos" INTEGER NOT NULL DEFAULT 0,
    "goles" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elo_general_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "elo_general_elo_idx" ON "elo_general"("elo");

-- El ELO general de cada jugador sale de sus ELO en cada sala:
--   elo      = promedio de los ELO de las salas, pesado por los partidos jugados en cada una
--              (si jugó 30 partidos en 3v3 y 10 en Real Soccer, el 3v3 pesa 3 veces más)
--   partidos, ganados, empatados, perdidos, goles = la suma de todas las salas
--   nombre   = el último con el que jugó
--
--   CALL actualizar_elo_general();                              -- recalcula a todos
--   CALL actualizar_elo_general(ARRAY['auth:abc', 'nick:pepe']);  -- solo a esos (después de un partido)
CREATE OR REPLACE PROCEDURE actualizar_elo_general(p_claves TEXT[] DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    WITH todas AS (
        SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "elo_3v3"
        UNION ALL
        SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "elo_4v4"
        UNION ALL
        SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "elo_todos"
        UNION ALL
        SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM "elo_realsoccer"
    ),
    elegidas AS (
        SELECT * FROM todas WHERE p_claves IS NULL OR clave = ANY (p_claves)
    ),
    calculo AS (
        SELECT
            clave,
            (ARRAY_AGG(nombre ORDER BY actualizado DESC))[1] AS nombre,
            CASE WHEN SUM(partidos) > 0
                 THEN ROUND(SUM(elo::NUMERIC * partidos) / SUM(partidos))::INTEGER
                 ELSE 1000 END AS elo,
            SUM(partidos)::INTEGER  AS partidos,
            SUM(ganados)::INTEGER   AS ganados,
            SUM(empatados)::INTEGER AS empatados,
            SUM(perdidos)::INTEGER  AS perdidos,
            SUM(goles)::INTEGER     AS goles,
            MAX(actualizado)        AS actualizado
        FROM elegidas
        GROUP BY clave
    )
    INSERT INTO "elo_general" (clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado)
    SELECT clave, nombre, elo, partidos, ganados, empatados, perdidos, goles, actualizado FROM calculo
    ON CONFLICT (clave) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        elo = EXCLUDED.elo,
        partidos = EXCLUDED.partidos,
        ganados = EXCLUDED.ganados,
        empatados = EXCLUDED.empatados,
        perdidos = EXCLUDED.perdidos,
        goles = EXCLUDED.goles,
        actualizado = EXCLUDED.actualizado;

    -- Los que ya no están en ninguna sala (se borraron) salen del general
    DELETE FROM "elo_general" g
    WHERE (p_claves IS NULL OR g.clave = ANY (p_claves))
      AND NOT EXISTS (
          SELECT 1 FROM "elo_3v3" x WHERE x.clave = g.clave
          UNION ALL
          SELECT 1 FROM "elo_4v4" x WHERE x.clave = g.clave
          UNION ALL
          SELECT 1 FROM "elo_todos" x WHERE x.clave = g.clave
          UNION ALL
          SELECT 1 FROM "elo_realsoccer" x WHERE x.clave = g.clave
      );
END;
$$;
