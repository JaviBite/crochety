import { getLocale, getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function DashboardHome() {
  const [t, locale, session] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
    auth(),
  ]);

  // Métricas globales: ganado = pedidos cobrados; gastado = total de gastos.
  const [earnedAgg, spentAgg, users, paidByUser, earnedByUser] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { priceCents: true },
        where: { status: "COBRADO" },
      }),
      prisma.expense.aggregate({ _sum: { totalCents: true } }),
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.expense.groupBy({ by: ["paidById"], _sum: { totalCents: true } }),
      prisma.order.groupBy({
        by: ["assignedToId"],
        _sum: { priceCents: true },
        where: { status: "COBRADO" },
      }),
    ]);

  const totalEarned = earnedAgg._sum.priceCents ?? 0;
  const totalSpent = spentAgg._sum.totalCents ?? 0;

  const metrics = [
    { label: t("totalEarned"), hint: t("totalEarnedHint"), value: totalEarned },
    { label: t("totalSpent"), hint: t("totalSpentHint"), value: totalSpent },
    { label: t("profit"), hint: t("profitHint"), value: totalEarned - totalSpent },
  ];

  const balances = users.map((user) => {
    const paid =
      paidByUser.find((p) => p.paidById === user.id)?._sum.totalCents ?? 0;
    const earned =
      earnedByUser.find((e) => e.assignedToId === user.id)?._sum.priceCents ?? 0;
    return { user, paid, earned, net: earned - paid };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("greeting", { name: session?.user.name ?? "" })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatCents(metric.value, locale)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {metric.hint}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{t("balanceTitle")}</CardTitle>
          <CardDescription>{t("balanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {balances.map(({ user, paid, earned, net }) => (
              <div key={user.id} className="rounded-xl border p-4">
                <p className="font-semibold">{user.name}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("balancePaid")}</dt>
                    <dd className="tabular-nums">{formatCents(paid, locale)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("balanceEarned")}</dt>
                    <dd className="tabular-nums">{formatCents(earned, locale)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>{t("balanceNet")}</dt>
                    <dd className="tabular-nums">{formatCents(net, locale)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
