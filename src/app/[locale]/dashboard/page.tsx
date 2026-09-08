import { ArrowRight, Coins, HeartHandshake, ShoppingBasket, Sprout } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { avatarHue, initialsOf } from "@/lib/avatar";
import { computeSettlements } from "@/lib/balance";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type CssWithHue = React.CSSProperties & { "--avatar-h": number };

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
  const profit = totalEarned - totalSpent;

  // Tinte por métrica: ganado=acento, gastado=muted, beneficio=positivo.
  const profitTint =
    profit > 0
      ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : profit < 0
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";

  const metrics = [
    {
      label: t("totalEarned"),
      hint: t("totalEarnedHint"),
      value: totalEarned,
      icon: Coins,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: t("totalSpent"),
      hint: t("totalSpentHint"),
      value: totalSpent,
      icon: ShoppingBasket,
      tint: "bg-muted text-muted-foreground",
    },
    {
      label: t("profit"),
      hint: t("profitHint"),
      value: profit,
      icon: Sprout,
      tint: profitTint,
    },
  ];

  const balances = users.map((user) => {
    const paid =
      paidByUser.find((p) => p.paidById === user.id)?._sum.totalCents ?? 0;
    const earned =
      earnedByUser.find((e) => e.assignedToId === user.id)?._sum.priceCents ?? 0;
    return { user, paid, earned, net: earned - paid };
  });

  // Quién debe a quién: gastos e ingresos a medias (los pedidos cobrados sin
  // asignar no se reparten porque no se sabe quién tiene el dinero).
  const settlements = computeSettlements(
    balances.map(({ user, paid, earned }) => ({
      id: user.id,
      name: user.name,
      paidCents: paid,
      earnedCents: earned,
    })),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1-display">
          {t("greeting", { name: session?.user.name ?? "" })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="cozy-card rounded-2xl shadow-sm">
            <CardContent className="flex items-start gap-4 py-5">
              <span
                aria-hidden
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  metric.tint,
                )}
              >
                <metric.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="font-heading text-2xl font-extrabold tracking-tight tabular-nums">
                  {formatCents(metric.value, locale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.hint}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">{t("balanceTitle")}</CardTitle>
          <CardDescription>{t("balanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transferencias para saldar: X → Y con el importe a la derecha. */}
          <div className="rounded-xl border bg-accent/30 p-4">
            {settlements.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium">
                <HeartHandshake className="size-4 text-primary" />
                {t("settledUp")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {settlements.map((settlement) => (
                  <li
                    key={`${settlement.from.id}-${settlement.to.id}`}
                    aria-label={t("owes", {
                      from: settlement.from.name,
                      to: settlement.to.name,
                      amount: formatCents(settlement.amountCents, locale),
                    })}
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <span>{settlement.from.name}</span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-primary"
                    />
                    <span>{settlement.to.name}</span>
                    <span className="ml-auto tabular-nums">
                      {formatCents(settlement.amountCents, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settlementHint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {balances.map(({ user, paid, earned, net }) => (
              <div
                key={user.id}
                className="cozy-card flex gap-4 rounded-xl border p-4"
              >
                <span
                  className="initials-avatar flex size-11 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold"
                  style={{ "--avatar-h": avatarHue(user.name) } as CssWithHue}
                  aria-hidden
                >
                  {initialsOf(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{user.name}</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {t("balancePaid")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatCents(paid, locale)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {t("balanceEarned")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatCents(earned, locale)}
                      </dd>
                    </div>
                    <div className="flex justify-between font-medium">
                      <dt>{t("balanceNet")}</dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          net > 0 && "text-emerald-700 dark:text-emerald-400",
                          net < 0 && "text-destructive",
                        )}
                      >
                        {formatCents(net, locale)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
