import { config as loadEnv } from "dotenv";
import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Como Next: primero .env.development.local (lo escribe `vercel env pull`),
// luego .env. dotenv no pisa variables ya definidas, así que gana el primero.
loadEnv({ path: [".env.development.local", ".env"] });

const adapter = new PrismaPg({
  // Script puntual: mejor la conexión directa (sin pgbouncer) si está definida.
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedUser = { name: string; email: string; password: string };

function userFromEnv(prefix: "USER1" | "USER2"): SeedUser | null {
  const name = process.env[`${prefix}_NAME`];
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!name || !email || !password) {
    console.warn(
      `⚠️  Faltan variables ${prefix}_NAME / ${prefix}_EMAIL / ${prefix}_PASSWORD — se omite este usuario.`,
    );
    return null;
  }
  return { name, email, password };
}

async function main() {
  const users = [userFromEnv("USER1"), userFromEnv("USER2")].filter(
    (u): u is SeedUser => u !== null,
  );

  for (const user of users) {
    // Solo bootstrap: si el usuario ya existe NO se toca — su nombre y
    // contraseña se gestionan desde la app (perfil / gestor de usuarios) y el
    // seed corre en cada deploy (vercel-build), no debe machacarlos.
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (existing) {
      console.log(`↩️  Usuario ya existente (no se toca): <${user.email}>`);
      continue;
    }
    const passwordHash = hashSync(user.password, 12);
    // Las fundadoras (usuarios del .env) administran el taller.
    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`✅ Usuario creado: ${user.name} <${user.email}>`);
  }

  if (users.length === 0) {
    console.error("No se ha creado ningún usuario. Revisa tu .env");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
