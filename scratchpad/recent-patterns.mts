// Últimos patrones creados (para ver el que guardó el usuario desde el convertidor).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
const { prisma } = await import("../src/lib/prisma");

const recent = await prisma.pattern.findMany({
  orderBy: { createdAt: "desc" },
  take: 6,
  select: {
    id: true,
    title: true,
    aiStatus: true,
    coverImagePath: true,
    standardizedContent: true,
    createdAt: true,
  },
});
for (const p of recent) {
  console.log(
    `${p.createdAt.toISOString()} · ${p.id} · "${p.title}" · ${p.aiStatus} · `
      + `cover=${p.coverImagePath ?? "-"} · content=${p.standardizedContent?.length ?? 0} chars`,
  );
}
