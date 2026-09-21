-- Los carteles de INICIO: el aviso que sale cuando arranca el partido (el saque inicial),
-- que no es un gol. Antes el 0-0 del arranque se tomaba como gol y salía el cartel de gol.
--
-- No se venden: son configuración. Solo uno queda puesto (activo) y lo usan las 4 salas.
--
-- `colores` es un color por LETRA del texto, en el mismo orden. Si vienen menos que letras,
-- las que sobran usan el último. En el chat de HaxBall se usa el primero (el chat admite un
-- solo color por mensaje); las letras de colores se ven con la extensión de ÑandutíHax.

CREATE TABLE "inicios" (
    "clave"       TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "plantilla"   TEXT NOT NULL,
    "colores"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "color"       TEXT NOT NULL DEFAULT 'FFD700',
    "estilo"      TEXT NOT NULL DEFAULT 'bold',
    "sonido"      INTEGER NOT NULL DEFAULT 2,
    "puesto"      BOOLEAN NOT NULL DEFAULT false,
    "cambiadoPor" TEXT,
    "cambiado"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inicios_pkey" PRIMARY KEY ("clave")
);

-- Uno solo puede estar puesto a la vez
CREATE UNIQUE INDEX "inicios_puesto_key" ON "inicios"("puesto") WHERE "puesto" = true;

-- Uno de fábrica, para que la pantalla no arranque vacía
INSERT INTO "inicios" ("clave", "nombre", "descripcion", "plantilla", "colores", "color", "estilo", "puesto")
VALUES (
  'arranca',
  'Arranca el partido',
  'El de siempre: avisa que empieza y con qué camisetas',
  '⚽ ¡ARRANCA EL PARTIDO! {rojo} 🆚 {azul}',
  ARRAY[]::TEXT[],
  'FFD700',
  'bold',
  true
);
