-- Ajustes generales de la web (los toca solo el OWNER, desde el panel).
-- Solo se guarda lo que se cambió: lo que no está acá usa el valor de fábrica del catálogo.
CREATE TABLE "ajustes" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "cambiadoPor" TEXT,
    "cambiado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("clave")
);
