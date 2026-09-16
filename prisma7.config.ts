// Config de Prisma 7 (el schema ya no lleva la URL adentro).
// La URL sale de DATABASE_URL: los scripts de package.json corren el CLI con
// "node --env-file-if-exists=.env", así que .env alcanza y no hace falta dotenv.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
