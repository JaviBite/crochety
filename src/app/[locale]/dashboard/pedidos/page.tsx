import { Package, Plus } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
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
import type { OrderStatus } from "@/lib/validations";

const STATUS_CLASSES: Record<OrderStatus, string> = {
  SIN_EMPEZAR: "bg-muted text-muted-foreground",
  EMPEZADO: "bg-accent text-accent-foreground",
  TERMINADO: "bg-primary/15 text-primary",
  COBRADO: "bg-primary text-primary-foreground",
};

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
          <Link href="/dashboard/pedidos/nuevo">
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {order.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${order.photos[0].path}`}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
