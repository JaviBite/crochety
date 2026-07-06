import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "../expense-form";

export default async function NewExpensePage() {
  const t = await getTranslations("Expenses");
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <ExpenseForm users={users} />
    </div>
  );
}
