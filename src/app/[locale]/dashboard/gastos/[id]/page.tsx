import { ArrowLeft, Pencil, Receipt } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const BASE_PATH = "/dashboard/gastos";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale, format, expense] = await Promise.all([
    getTranslations("Expenses"),
    getLocale(),
    getFormatter(),
    prisma.expense.findUnique({
      where: { id },
      include: {
        paidBy: { select: { name: true } },
        items: true,
        photos: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <Link href={BASE_PATH} className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        {t("detailBack")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{expense.store ?? t("fieldStore")}</h1>
            <Badge variant={expense.received ? "default" : "secondary"}>
              {expense.received ? t("received") : t("pending")}
            </Badge>
          </div>
          <p className="text-muted-foreground">{expense.notes ?? "—"}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${BASE_PATH}/editar/${expense.id}`}>
            <Pencil className="size-4" />
            {t("editTitle")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("itemsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldDate")}</p>
                <p>{format.dateTime(expense.date, { dateStyle: "medium" })}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldPaidBy")}</p>
                <p>{expense.paidBy.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldShipping")}</p>
                <p>{formatCents(expense.shippingCents, locale)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldTotal")}</p>
                <p>{formatCents(expense.totalCents, locale)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {expense.items.map((item) => (
                <div key={item.id} className="rounded-xl border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{item.item}</span>
                    <span className="text-sm">{item.quantity} × {formatCents(item.unitPriceCents, locale)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t("fieldTotal")}: {formatCents(item.totalCents, locale)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("photosTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {expense.photos.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="size-4" />
                <span>{t("photosHint")}</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {expense.photos.map((photo) => (
                  <img key={photo.id} src={`/api/files/${photo.path}`} alt={expense.store ?? t("fieldStore")} className="w-full rounded-xl border object-cover" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
