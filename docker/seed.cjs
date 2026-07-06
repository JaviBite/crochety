// Seed de producción: crea/actualiza los 2 usuarios definidos en el entorno.
// Es idéntico en efecto a prisma/seed.ts, pero en JS plano y contra SQLite
// directamente, para no necesitar tsx ni el cliente Prisma en el contenedor.
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const { hashSync } = require("bcryptjs");

const url = process.env.DATABASE_URL ?? "file:/app/data/crochety.db";
const dbPath = url.replace(/^file:/, "");
const db = new Database(dbPath);

const upsert = db.prepare(`
  INSERT INTO "User" ("id", "name", "email", "passwordHash")
  VALUES (@id, @name, @email, @passwordHash)
  ON CONFLICT("email") DO UPDATE SET
    "name" = excluded."name",
    "passwordHash" = excluded."passwordHash"
`);

let created = 0;
for (const prefix of ["USER1", "USER2"]) {
  const name = process.env[`${prefix}_NAME`];
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];

  if (!name || !email || !password) {
    console.warn(
      `⚠️  Faltan ${prefix}_NAME / ${prefix}_EMAIL / ${prefix}_PASSWORD — se omite este usuario.`,
    );
    continue;
  }

  upsert.run({
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    passwordHash: hashSync(password, 12),
  });
  console.log(`✅ Usuario listo: ${name} <${email}>`);
  created += 1;
}

db.close();

if (created === 0) {
  console.error("No se ha creado ningún usuario. Revisa las variables de entorno.");
  process.exit(1);
}
