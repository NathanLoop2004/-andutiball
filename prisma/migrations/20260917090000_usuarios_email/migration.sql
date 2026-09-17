-- Correo para recuperar la cuenta, y el link de recuperación (se guarda su hash, no el link)
ALTER TABLE "usuarios" ADD COLUMN "email" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "recuperarHash" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "recuperarVence" TIMESTAMP(3);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_recuperarHash_key" ON "usuarios"("recuperarHash");
