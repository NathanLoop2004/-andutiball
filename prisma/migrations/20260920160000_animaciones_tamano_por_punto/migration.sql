-- Cada punto de la animación puede tener su propio tamaño, para poder decidir en qué
-- momento el jugador se hace grande y cuánto. Va en paralelo a "cuadros": mismo largo,
-- misma posición. tamanoDesde/tamanoHasta quedan para las animaciones viejas.
ALTER TABLE "animaciones"
  ADD COLUMN "tamanos" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
