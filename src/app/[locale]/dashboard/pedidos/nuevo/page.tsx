import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  const t = await getTranslations("Orders");
  const [users, patterns, materials] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pattern.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.material.findMany({
      select: { id: true, name: true, priceCents: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <OrderForm users={users} patterns={patterns} materials={materials} />
    </div>
  );
}
