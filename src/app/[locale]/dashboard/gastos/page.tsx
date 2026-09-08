import { Plus, Receipt } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ListSearch } from "@/components/dashboard/list-search";
import { RowActions } from "@/components/dashboard/row-actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/search";
import { deleteExpense } from "./actions";

const BASE_PATH = "/dashboard/gastos";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = normalizeSearch(q);

  const where: Prisma.ExpenseWhereInput | undefined = search
    ? {
        OR: [
          { store: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { items: { some: { item: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : undefined;

  const [t, locale, format] = await Promise.all([
    getTranslations("Expenses"),
    getLocale(),
    getFormatter(),
  ]);

  // Inicio del mes natural local para el total de la cabecera.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [expenses, monthAgg] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        paidBy: { select: { name: true } },
        items: { select: { item: true, quantity: true } },
      },
    }),
    prisma.expense.aggregate({
      _sum: { totalCents: true },
      where: { date: { gte: monthStart } },
    }),
  ]);

  const itemsSummary = (expense: {
    items: { item: string; quantity: number }[];
  }) =>
    expense.items
      .map((line) =>
        line.quantity > 1 ? `${line.item} ×${line.quantity}` : line.item,
      )
      .join(", ") || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1-display">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("spentThisMonth", {
              total: formatCents(monthAgg._sum.totalCents ?? 0, locale),
            })}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/gastos/nuevo">
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      <ListSearch className="max-w-sm" />

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title={search ? t("noResultsTitle") : t("emptyTitle")}
          description={
            search ? t("noResultsDescription") : t("emptyDescription")
          }
          action={
            search
              ? undefined
              : { href: `${BASE_PATH}/nuevo`, label: t("add") }
          }
        />
      ) : (
        <>
          {/* Escritorio: libro contable; móvil: tarjetas apiladas. */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colPurchase")}</TableHead>
                  <TableHead className="text-right">{t("colTotal")}</TableHead>
                  <TableHead>{t("colPaidBy")}</TableHead>
                  <TableHead>{t("colReceived")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(expense.date, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="max-w-72 font-medium">
                      {expense.store ? (
                        <>
                          {expense.store}
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {itemsSummary(expense)}
                          </p>
                        </>
                      ) : (
                        <span className="line-clamp-2">{itemsSummary(expense)}</span>
                      )}
                      {expense.notes && (
                        <p className="truncate text-xs font-normal text-muted-foreground">
                          {expense.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCents(expense.totalCents, locale)}
                    </TableCell>
                    <TableCell>{expense.paidBy.name}</TableCell>
                    <TableCell>
                      {/* Solo se avisa de lo pendiente: lo recibido es el
                          estado normal y no necesita ruido visual. */}
                      {expense.received ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-destructive/15 text-destructive"
                        >
                          {t("pending")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        viewHref={`${BASE_PATH}/${expense.id}`}
                        editHref={`${BASE_PATH}/editar/${expense.id}`}
                        deleteAction={deleteExpense.bind(null, expense.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 sm:hidden">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="cozy-card rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(expense.date, { dateStyle: "medium" })}
                    </p>
                    <p className="font-medium">
                      {expense.store || itemsSummary(expense)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">
                    {formatCents(expense.totalCents, locale)}
                  </p>
                </div>
                {expense.store && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {itemsSummary(expense)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {expense.paidBy.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {!expense.received && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-destructive/15 text-destructive"
                      >
                        {t("pending")}
                      </Badge>
                    )}
                    <RowActions
                      viewHref={`${BASE_PATH}/${expense.id}`}
                      editHref={`${BASE_PATH}/editar/${expense.id}`}
                      deleteAction={deleteExpense.bind(null, expense.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
