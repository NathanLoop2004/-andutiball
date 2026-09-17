-- Código de 6 números por correo para cambiar la clave desde "Mi cuenta" (se guarda su hash)
ALTER TABLE "usuarios" ADD COLUMN "codigoHash" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "codigoVence" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN "codigoIntentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuarios" ADD COLUMN "codigoPedido" TIMESTAMP(3);
