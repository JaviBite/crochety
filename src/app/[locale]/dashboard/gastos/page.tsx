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

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      paidBy: { select: { name: true } },
      items: { select: { item: true, quantity: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
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
          icon={Receipt}
          title={search ? t("noResultsTitle") : t("emptyTitle")}
          description={
            search ? t("noResultsDescription") : t("emptyDescription")
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
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
              {expenses.map((expense) => {
                const summary =
                  expense.items
                    .map((line) =>
                      line.quantity > 1 ? `${line.item} ×${line.quantity}` : line.item,
                    )
                    .join(", ") || "—";
                return (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(expense.date, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="max-w-72 font-medium">
                      {expense.store ? (
                        <>
                          {expense.store}
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {summary}
                          </p>
                        </>
                      ) : (
                        <span className="line-clamp-2">{summary}</span>
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
                      <Badge
                        variant="outline"
                        className={
                          expense.received
                            ? "border-transparent bg-primary/15 text-primary"
                            : "border-transparent bg-muted text-muted-foreground"
                        }
                      >
                        {expense.received ? t("received") : t("pending")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        editHref={`${BASE_PATH}/editar/${expense.id}`}
                        deleteAction={deleteExpense.bind(null, expense.id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
