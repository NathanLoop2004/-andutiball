-- Los carteles de los MOMENTOS del partido. La tabla nació como "inicios" (solo el saque) y
-- ahora guarda también el de la VICTORIA, que reemplaza al "Red is Victorious!" de HaxBall.
--
-- Se renombra con ALTER TABLE (no se borra y se vuelve a crear: se perderían los datos).
-- Queda un cartel puesto POR MOMENTO, no uno solo en total.

ALTER TABLE "inicios" RENAME TO "carteles_momento";
ALTER TABLE "carteles_momento" ADD COLUMN "momento" TEXT NOT NULL DEFAULT 'inicio';

DROP INDEX IF EXISTS "inicios_puesto_key";
CREATE UNIQUE INDEX "carteles_momento_puesto_key"
  ON "carteles_momento"("momento") WHERE "puesto" = true;
CREATE INDEX "carteles_momento_momento_idx" ON "carteles_momento"("momento");

-- Uno de fábrica para la victoria, así la pantalla no arranca vacía
INSERT INTO "carteles_momento"
  ("clave", "momento", "nombre", "descripcion", "plantilla", "colores", "color", "estilo", "puesto")
VALUES (
  'gano',
  'victoria',
  'Ganó el partido',
  'El de siempre: quién ganó y con qué resultado',
  '🏆 ¡GANÓ {ganador}! {golesGanador} 🆚 {golesPerdedor} {perdedor}',
  ARRAY[]::TEXT[],
  'FFD700',
  'bold',
  true
);
