import { ArrowRight, Coins, HeartHandshake, ShoppingBasket, Sprout } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { avatarHue, initialsOf } from "@/lib/avatar";
import { computeSettlements, filterParticipants } from "@/lib/balance";
import { getFormatter } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { isOrderOverdue, resolveOrderCollectorId } from "@/lib/orders";
import { getLowStockThreshold } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/validations";

type CssWithHue = React.CSSProperties & { "--avatar-h": number };

export default async function DashboardHome() {
  const [t, tStatus, locale, format, session] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("OrderStatus"),
    getLocale(),
    getFormatter(),
    auth(),
  ]);

  // Inicio del día actual y ventana de 7 días para las entregas.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  // El umbral decide si la consulta de stock bajo tiene sentido (0 = off).
  const lowStockThreshold = await getLowStockThreshold();

  // Métricas globales: ganado = pedidos cobrados; gastado = total de gastos.
  const [
    earnedAgg,
    spentAgg,
    users,
    paidByUser,
    paidOrders,
    dueOrders,
    statusCounts,
    lowStock,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { priceCents: true },
      where: { status: "COBRADO" },
    }),
    prisma.expense.aggregate({ _sum: { totalCents: true } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.expense.groupBy({ by: ["paidById"], _sum: { totalCents: true } }),
    // Cobrado = pedidos COBRADO agrupados por su cobrador efectivo (el campo
    // collectedById o, por defecto, el asignado). Se resuelve en cliente:
    // Prisma no puede agrupar por COALESCE(collectedById, assignedToId).
    prisma.order.findMany({
      where: { status: "COBRADO" },
      select: { priceCents: true, assignedToId: true, collectedById: true },
    }),
    // Entregas próximas/vencidas: ≤7 días (o pasado) y no cobradas.
    prisma.order.findMany({
      where: {
        dueDate: { not: null, lte: inSevenDays },
        status: { not: "COBRADO" },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        name: true,
        dueDate: true,
        status: true,
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    // Stock bajo (0 = aviso desactivado en Ajustes).
    lowStockThreshold === 0
      ? Promise.resolve([])
      : prisma.material.findMany({
          where: { stock: { lte: lowStockThreshold } },
          orderBy: { stock: "asc" },
          take: 5,
          select: { id: true, name: true, stock: true },
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

  // Balance solo entre quienes participan del bote común (los usuarios
  // marcados como no participantes quedan fuera del reparto).
  // Ingresos por cobrador efectivo: el cobrador explícito o, por defecto,
  // quien tiene el pedido asignado (pedidos antiguos incluidos).
  const earnedByCollector = new Map<string, number>();
  for (const order of paidOrders) {
    const collectorId = resolveOrderCollectorId(order);
    if (collectorId) {
      earnedByCollector.set(
        collectorId,
        (earnedByCollector.get(collectorId) ?? 0) + order.priceCents,
      );
    }
  }

  const balances = filterParticipants(users).map((user) => {
    const paid =
      paidByUser.find((p) => p.paidById === user.id)?._sum.totalCents ?? 0;
    const earned = earnedByCollector.get(user.id) ?? 0;
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

  // Escala común para el mini gráfico: la barra más grande ± marca el rango.
  const maxAbsNet = Math.max(
    1,
    ...balances.map((balance) => Math.abs(balance.net)),
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

      {/* Panel operativo: entregas, estados y stock bajo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="cozy-card rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("deliveriesTitle")}</CardTitle>
            <CardDescription>{t("deliveriesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dueOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("deliveriesEmpty")}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {dueOrders.map((order) => (
                  <li key={order.id} className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/pedidos/${order.id}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {order.name}
                    </Link>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        isOrderOverdue(order)
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {order.dueDate
                        ? format.dateTime(order.dueDate, { dateStyle: "short" })
                        : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/dashboard/pedidos?sort=due">
                {t("deliveriesSeeAll")}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="cozy-card rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("statusCountsTitle")}</CardTitle>
            <CardDescription>{t("statusCountsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ORDER_STATUSES.map((status) => {
              const count =
                statusCounts.find((entry) => entry.status === status)?._count
                  ._all ?? 0;
              return (
                <Link
                  key={status}
                  href={`/dashboard/pedidos?status=${status}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span>
                    {tStatus(status)}
                  </span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {lowStockThreshold > 0 && (
          <Card className="cozy-card rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("lowStockTitle")}</CardTitle>
              <CardDescription>
                {t("lowStockHint", { count: lowStockThreshold })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("lowStockEmpty")}
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {lowStock.map((material) => (
                    <li key={material.id} className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/materiales/${material.id}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {material.name}
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        ×{material.stock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link href="/dashboard/materiales">
                  {t("lowStockSeeAll")}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
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
                  {/* Mini gráfico: barra divergente desde el centro. Neto a
                      favor crece a la derecha (le deben); neto negativo a la
                      izquierda (debe). Escala común entre todas las tarjetas. */}
                  <div
                    className="relative mt-2 h-1.5 rounded-full bg-muted"
                    aria-hidden
                  >
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className={cn(
                        "absolute inset-y-0 rounded-full transition-all",
                        net > 0 && "left-1/2 bg-emerald-600 dark:bg-emerald-500",
                        net < 0 && "right-1/2 bg-destructive",
                      )}
                      style={{
                        width: `${(Math.abs(net) / maxAbsNet) * 50}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
