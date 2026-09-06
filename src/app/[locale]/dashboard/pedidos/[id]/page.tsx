import { ArrowLeft, Package, Pencil } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AssetImage } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const BASE_PATH = "/dashboard/pedidos";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale, format, order] = await Promise.all([
    getTranslations("Orders"),
    getLocale(),
    getFormatter(),
    prisma.order.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { name: true } },
        pattern: { select: { title: true } },
        materials: { include: { material: { select: { name: true } } } },
        photos: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <Link href={BASE_PATH} className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        {t("detailBack")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{order.name}</h1>
            <StatusBadge status={order.status} kind="order" />
          </div>
          <p className="text-muted-foreground">{order.description ?? t("fieldDescription")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${BASE_PATH}/editar/${order.id}`}>
            <Pencil className="size-4" />
            {t("editTitle")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("fieldDescription")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldQuantity")}</p>
                <p>{order.quantity}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldPrice")}</p>
                <p>{formatCents(order.priceCents, locale)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldCustomer")}</p>
                <p>{order.customer ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldAssignedTo")}</p>
                <p>{order.assignedTo?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldPattern")}</p>
                <p>{order.pattern?.title ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">{t("fieldDueDate")}</p>
                <p>{order.dueDate ? format.dateTime(order.dueDate, { dateStyle: "medium" }) : "—"}</p>
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Package className="size-4" />
                <span className="font-medium">{t("materialsTitle")}</span>
              </div>
              {order.materials.length === 0 ? (
                <p className="text-sm">{t("materialsEmpty")}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {order.materials.map((entry) => (
                    <li key={`${order.id}-${entry.materialId}`} className="flex items-center justify-between gap-2">
                      <span>{entry.material.name}</span>
                      <span className="text-foreground">{entry.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("fieldPhoto")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fieldPhoto")}</p>
            ) : (
              <div className="grid gap-3">
                {order.photos.map((photo) => (
                  <AssetImage
                    key={photo.id}
                    src={assetUrl(photo.path)}
                    alt={order.name}
                    className="w-full rounded-xl border object-cover"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
