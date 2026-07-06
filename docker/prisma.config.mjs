// Config de Prisma para el contenedor: sin dotenv (las variables llegan por
// el entorno de docker-compose) y con rutas relativas a /app/migrator.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
