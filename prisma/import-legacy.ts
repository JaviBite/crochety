import { readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Importador puntual de los datos históricos (Excel ZgzStitches + Homebox).
// Los datos ya parseados viven en prisma/legacy-data/*.json (ver generador en
// el scratchpad). Este script SOLO los inserta.
//
//   BORRA pedidos, gastos, materiales y patrones antes de importar (lo pedido).
//   NO toca usuarios (salvo resetear la contraseña de Javier) ni ajustes.
//
// Uso:
//   npx tsx prisma/import-legacy.ts            → DRY RUN (no escribe nada)
//   npx tsx prisma/import-legacy.ts --confirm  → borra e importa de verdad
//
// Requiere la migración aplicada en la BD destino (columna role + tabla Setting).
// ---------------------------------------------------------------------------

loadEnv({ path: [".env.development.local", ".env"] });

const CONFIRM = process.argv.includes("--confirm");
const eurToCents = (eur: number | null | undefined) =>
  Math.round((eur ?? 0) * 100);
const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// --- Tipos de los ficheros de datos -----------------------------------------
type LegacyOrder = {
  date: string | null;
  name: string;
  quantity: number;
  priceEur: number;
  patternUrl: string | null;
  customer: string | null;
  maker: string | null;
  status: string;
  completedAt: string | null;
};
type LegacyExpense = {
  date: string | null;
  item: string;
  quantity: number;
  unitPriceEur: number;
  totalEur: number;
  payer: string | null;
  received: boolean;
};
type LegacyMaterial = {
  name: string;
  category: string;
  location: string | null;
  link: string | null;
  priceEur: number;
  stock: number;
  brand?: string | null;
  weight?: string | null;
};

function readJson<T>(file: string): T {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "prisma", "legacy-data", file), "utf8"),
  ) as T;
}

// --- Resolución de personas → usuarios de la app ----------------------------
// En los datos hay 3 personas identificadas por nombre o email; se buscan entre
// los usuarios existentes por email exacto o porque el nombre contiene la clave.
const PEOPLE = [
  {
    key: "javier",
    emails: ["javier@example.com", "javiergimenezgarces@gmail.com"],
    labels: ["javier gimenez", "javier"],
  },
  {
    key: "alba",
    emails: ["xr24alba@gmail.com"],
    labels: ["xr24alba@gmail.com", "alba vallés", "alba valles", "alba"],
  },
  {
    key: "natalia",
    emails: ["nataliachueca98@gmail.com"],
    labels: ["nataliachueca98@gmail.com", "natalia"],
  },
];

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const orders = readJson<LegacyOrder[]>("pedidos.json");
  const expenses = readJson<LegacyExpense[]>("gastos.json");
  const materials = readJson<LegacyMaterial[]>("materiales.json");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  function personFor(label: string) {
    const l = norm(label);
    return PEOPLE.find((p) => p.labels.includes(l) || p.emails.includes(l));
  }
  function userIdFor(label: string | null): {
    id: string | null;
    unknown?: boolean;
  } {
    if (!label) return { id: null };
    const person = personFor(label);
    if (!person) return { id: null, unknown: true };
    const user = users.find(
      (u) =>
        person.emails.includes(norm(u.email)) || norm(u.name).includes(person.key),
    );
    return { id: user?.id ?? null, unknown: !user };
  }

  // Validación previa: mostrar cómo se resuelve cada etiqueta y abortar si algún
  // PAGADOR (obligatorio) no tiene usuario. Todo esto ANTES de borrar nada.
  const makerLabels = [...new Set(orders.map((o) => o.maker).filter(Boolean))] as string[];
  const payerLabels = [...new Set(expenses.map((e) => e.payer).filter(Boolean))] as string[];

  console.log("Usuarios en la BD:", users.map((u) => `${u.name} <${u.email}>`).join(", ") || "(ninguno)");
  console.log("\nResolución de personas:");
  for (const label of [...new Set([...makerLabels, ...payerLabels])]) {
    const r = userIdFor(label);
    const target = r.id ? users.find((u) => u.id === r.id) : null;
    console.log(`  ${label.padEnd(32)} → ${target ? `${target.name} <${target.email}>` : "SIN USUARIO"}`);
  }

  const missingPayers = payerLabels.filter((l) => !userIdFor(l).id);
  if (missingPayers.length) {
    throw new Error(
      `No hay usuario para estos pagadores (crea el usuario o ajusta PEOPLE): ${missingPayers.join(", ")}`,
    );
  }

  // Patrones únicos por URL (título = nombre del primer pedido que la usa).
  const patternTitleByUrl = new Map<string, string>();
  for (const o of orders) {
    if (o.patternUrl && !patternTitleByUrl.has(o.patternUrl)) {
      patternTitleByUrl.set(o.patternUrl, o.name);
    }
  }

  console.log(
    `\nResumen: ${materials.length} materiales · ${patternTitleByUrl.size} patrones · ${orders.length} pedidos · ${expenses.length} gastos`,
  );

  if (!CONFIRM) {
    console.log(
      "\n[DRY RUN] No se ha escrito nada. Repite con --confirm para borrar e importar.",
    );
    return;
  }

  // --- Borrado (orden por FKs: pedidos y gastos antes que materiales) --------
  console.log("\nBorrando datos existentes…");
  await prisma.orderMaterial.deleteMany();
  await prisma.orderPhoto.deleteMany();
  await prisma.order.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.expensePhoto.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.material.deleteMany();
  await prisma.pattern.deleteMany();

  // --- Materiales ------------------------------------------------------------
  for (const m of materials) {
    await prisma.material.create({
      data: {
        name: m.name,
        category: m.category,
        location: m.location,
        link: m.link,
        priceCents: eurToCents(m.priceEur),
        stock: m.stock,
        brand: m.brand ?? null,
        weight: m.weight ?? null,
      },
    });
  }
  console.log(`  ✅ ${materials.length} materiales`);

  // --- Patrones (sin IA: aiStatus NONE) --------------------------------------
  const patternIdByUrl = new Map<string, string>();
  for (const [url, title] of patternTitleByUrl) {
    const pattern = await prisma.pattern.create({
      data: { title, externalUrl: url, aiStatus: "NONE" },
    });
    patternIdByUrl.set(url, pattern.id);
  }
  console.log(`  ✅ ${patternIdByUrl.size} patrones`);

  // --- Pedidos ---------------------------------------------------------------
  for (const o of orders) {
    await prisma.order.create({
      data: {
        name: o.name,
        quantity: o.quantity,
        priceCents: eurToCents(o.priceEur),
        status: o.status,
        customer: o.customer,
        assignedToId: userIdFor(o.maker).id,
        patternId: o.patternUrl ? patternIdByUrl.get(o.patternUrl) ?? null : null,
        completedAt: toDate(o.completedAt),
        createdAt: toDate(o.date) ?? new Date(),
      },
    });
  }
  console.log(`  ✅ ${orders.length} pedidos`);

  // --- Gastos (una línea por compra) -----------------------------------------
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        date: toDate(e.date) ?? new Date(),
        paidById: userIdFor(e.payer).id!,
        received: e.received,
        totalCents: eurToCents(e.totalEur),
        createdAt: toDate(e.date) ?? new Date(),
        items: {
          create: {
            item: e.item,
            quantity: e.quantity,
            unitPriceCents: eurToCents(e.unitPriceEur),
            totalCents: eurToCents(e.totalEur),
          },
        },
      },
    });
  }
  console.log(`  ✅ ${expenses.length} gastos`);

  // --- Reset de la contraseña de Javier (login) ------------------------------
  const javier = userIdFor("Javier Gimenez").id;
  const newPass = process.env.USER1_PASSWORD;
  if (javier && newPass) {
    await prisma.user.update({
      where: { id: javier },
      data: { passwordHash: hashSync(newPass, 12) },
    });
    console.log(`  ✅ Contraseña de Javier restablecida a USER1_PASSWORD del .env`);
  }

  console.log("\n✨ Importación completada.");
}

main()
  .catch((e) => {
    console.error("\n❌", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
