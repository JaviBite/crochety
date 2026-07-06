import { ExternalLink, Plus, Receipt } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
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
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { deleteExpense } from "./actions";

const BASE_PATH = "/dashboard/gastos";

export default async function ExpensesPage() {
  const [t, locale, format] = await Promise.all([
    getTranslations("Expenses"),
    getLocale(),
    getFormatter(),
  ]);

  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    include: { paidBy: { select: { name: true } } },
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

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colDate")}</TableHead>
                <TableHead>{t("colItem")}</TableHead>
                <TableHead className="text-right">{t("colQuantity")}</TableHead>
                <TableHead className="text-right">{t("colUnitPrice")}</TableHead>
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
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {expense.item}
                      {expense.link && (
                        <a
                          href={expense.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={t("colLink")}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </span>
                    {expense.notes && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {expense.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {expense.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(expense.unitPriceCents, locale)}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
