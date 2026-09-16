// Conexión a la base de TESTING. Solo se carga si DB_ENV=testing (ver ConexionBase.js).
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const url = process.env.DB_TESTING_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Falta DB_TESTING_URL (o DATABASE_URL) en .env");

const cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

module.exports = { cliente, url };
