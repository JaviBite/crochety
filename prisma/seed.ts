import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./data/crochety.db",
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
    const passwordHash = hashSync(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash },
      create: { name: user.name, email: user.email, passwordHash },
    });
    console.log(`✅ Usuario listo: ${user.name} <${user.email}>`);
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
