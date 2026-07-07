import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "../../expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, expense, users] = await Promise.all([
    getTranslations("Expenses"),
    prisma.expense.findUnique({
      where: { id },
      include: {
        items: {
          select: { item: true, quantity: true, unitPriceCents: true, link: true },
        },
        photos: { select: { path: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("editTitle")}</h1>
        <p className="text-muted-foreground">{t("editDescription")}</p>
      </div>
      <ExpenseForm
        users={users}
        expense={{
          id: expense.id,
          date: expense.date,
          store: expense.store,
          paidById: expense.paidById,
          shippingCents: expense.shippingCents,
          totalCents: expense.totalCents,
          received: expense.received,
          notes: expense.notes,
          items: expense.items,
          photos: expense.photos,
        }}
      />
    </div>
  );
}
