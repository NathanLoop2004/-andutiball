-- Vincular la cuenta de Discord (no para iniciar sesión). No se guarda ningún token de Discord.
ALTER TABLE "usuarios" ADD COLUMN "discordId" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "discordUsuario" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "discordAvatar" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "discordVinculado" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN "discordEstadoHash" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "discordEstadoVence" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN "discordVuelta" TEXT;

CREATE UNIQUE INDEX "usuarios_discordId_key" ON "usuarios"("discordId");
CREATE UNIQUE INDEX "usuarios_discordEstadoHash_key" ON "usuarios"("discordEstadoHash");
