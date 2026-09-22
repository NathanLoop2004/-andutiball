-- Cada punto de la animación puede tener también su ángulo de rotación (en grados, -180 a
-- 180), en paralelo a "cuadros" y "tamanos": mismo largo, misma posición. Solo se ve en la
-- vista previa de la web (el editor y las páginas de cada animación): la API de HaxBall no
-- tiene forma de girar el avatar de un jugador adentro del partido, así que en la sala de
-- verdad el emoji se ve derecho igual.
ALTER TABLE "animaciones"
  ADD COLUMN "rotaciones" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
