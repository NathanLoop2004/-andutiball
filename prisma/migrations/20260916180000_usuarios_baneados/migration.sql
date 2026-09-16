-- El OWNER puede banear una cuenta desde la web: no entra a ninguna sala hasta que la desbanee
ALTER TABLE "usuarios" ADD COLUMN "baneado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "motivoBan" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "baneadoEl" TIMESTAMP(3);
