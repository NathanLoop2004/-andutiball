-- Los jugadores pasan a llamarse usuarios, y cada uno tiene su clave.
-- Se renombra (no se borra y crea) para no perder lo que ya haya cargado.

ALTER TABLE "jugadores" RENAME TO "usuarios";
ALTER TABLE "usuarios" RENAME CONSTRAINT "jugadores_pkey" TO "usuarios_pkey";
ALTER TABLE "usuarios" RENAME CONSTRAINT "jugadores_rangoId_fkey" TO "usuarios_rangoId_fkey";
ALTER INDEX "jugadores_auth_key" RENAME TO "usuarios_auth_key";
DROP INDEX "jugadores_nick_idx";

-- La clave va atada al nombre, así que el nombre no se puede repetir
CREATE UNIQUE INDEX "usuarios_nick_key" ON "usuarios"("nick");

-- La clave nunca se guarda tal cual: acá va el hash (ver lib/claves.js)
ALTER TABLE "usuarios" ADD COLUMN "clave" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "claveCambiada" TIMESTAMP(3);

ALTER TABLE "participaciones" RENAME COLUMN "jugadorId" TO "usuarioId";
ALTER TABLE "participaciones" RENAME CONSTRAINT "participaciones_jugadorId_fkey" TO "participaciones_usuarioId_fkey";
ALTER INDEX "participaciones_partidoId_jugadorId_key" RENAME TO "participaciones_partidoId_usuarioId_key";
