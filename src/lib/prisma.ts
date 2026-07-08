import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton: evita agotar conexiones/instancias con el hot-reload de Next.js.
// En Vercel usar la URL "pooled" de Neon (pgbouncer) para no agotar conexiones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/** Violación de una restricción única (P2002), p. ej. email repetido. */
export function isUniqueViolation(error: unknown): boolean {
  return hasErrorCode(error, "P2002");
}

/** Violación de clave foránea (P2003), p. ej. borrar un usuario con gastos. */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasErrorCode(error, "P2003");
}
