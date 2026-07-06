import { Package, Plus } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { RowActions } from "@/components/dashboard/row-actions";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { parseView, viewCookieName } from "@/lib/view";
import type { OrderStatus } from "@/lib/validations";
import { deleteOrder } from "./actions";

const BASE_PATH = "/dashboard/pedidos";
const SECTION = "pedidos";

const STATUS_CLASSES: Record<OrderStatus, string> = {
  SIN_EMPEZAR: "bg-muted text-muted-foreground",
  EMPEZADO: "bg-accent text-accent-foreground",
  TERMINADO: "bg-primary/15 text-primary",
  COBRADO: "bg-primary text-primary-foreground",
};

// Portada del pedido: su foto propia o, si no tiene, la del patrón asociado.
function orderCover(order: {
  photos: { path: string }[];
  pattern: { coverImagePath: string | null } | null;
}): string | null {
  return order.photos[0]?.path ?? order.pattern?.coverImagePath ?? null;
}

export default async function OrdersPage() {
  const [t, tStatus, locale, format] = await Promise.all([
    getTranslations("Orders"),
    getTranslations("OrderStatus"),
    getLocale(),
    getFormatter(),
  ]);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { name: true } },
      photos: { where: { isCover: true }, take: 1 },
      pattern: { select: { coverImagePath: true } },
    },
  });

  const view = parseView(
    (await cookies()).get(viewCookieName(SECTION))?.value,
    "list",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && <ViewToggle section={SECTION} value={view} />}
          <Button asChild>
            <Link href="/dashboard/pedidos/nuevo">
              <Plus className="size-4" />
              {t("add")}
            </Link>
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : view === "list" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="text-right">{t("colQuantity")}</TableHead>
                <TableHead className="text-right">{t("colPrice")}</TableHead>
                <TableHead>{t("colAssignedTo")}</TableHead>
                <TableHead>{t("colDueDate")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const cover = orderCover(order);
                return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${cover}`}
                          alt=""
                          className="size-9 rounded-lg border object-cover"
                        />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Package className="size-4" />
                        </span>
                      )}
                      <div>
                        {order.name}
                        {order.customer && (
                          <p className="text-xs font-normal text-muted-foreground">
                            {t("forCustomer", { name: order.customer })}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-transparent ${STATUS_CLASSES[order.status as OrderStatus] ?? ""}`}
                    >
                      {tStatus(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {order.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(order.priceCents, locale)}
                  </TableCell>
                  <TableCell>{order.assignedTo?.name ?? "—"}</TableCell>
                  <TableCell>
                    {order.dueDate
                      ? format.dateTime(order.dueDate, { dateStyle: "medium" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editHref={`${BASE_PATH}/editar/${order.id}`}
                      deleteAction={deleteOrder.bind(null, order.id)}
                    />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const cover = orderCover(order);
            return (
            <Card
              key={order.id}
              className="overflow-hidden rounded-2xl pt-0 shadow-sm"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${cover}`}
                  alt={order.name}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-accent text-accent-foreground">
                  <Package className="size-8" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {order.name}
                    {order.customer && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {t("forCustomer", { name: order.customer })}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge
                      variant="outline"
                      className={`border-transparent ${STATUS_CLASSES[order.status as OrderStatus] ?? ""}`}
                    >
                      {tStatus(order.status)}
                    </Badge>
                    <RowActions
                      editHref={`${BASE_PATH}/editar/${order.id}`}
                      deleteAction={deleteOrder.bind(null, order.id)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums">
                    {order.quantity} · {formatCents(order.priceCents, locale)}
                  </span>
                  {order.assignedTo?.name && <span>{order.assignedTo.name}</span>}
                </div>
                {order.dueDate && (
                  <p className="text-xs">
                    {format.dateTime(order.dueDate, { dateStyle: "medium" })}
                  </p>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
