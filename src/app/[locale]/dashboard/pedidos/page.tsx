import { Package, Plus } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AssetImage } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
import { OrderCard } from "@/components/dashboard/cards";
import { ListSearch } from "@/components/dashboard/list-search";
import { OrderFilters } from "@/components/dashboard/order-filters";
import { RowActions } from "@/components/dashboard/row-actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { EmptyState } from "@/components/empty-state";
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
import { parseView, viewCookieName } from "@/lib/view";
import { ORDER_STATUSES } from "@/lib/validations";
import { deleteOrder } from "./actions";

const BASE_PATH = "/dashboard/pedidos";
const SECTION = "pedidos";

// Portada del pedido: su foto propia o, si no tiene, la del patrón asociado.
function orderCover(order: {
  photos: { path: string }[];
  pattern: { coverImagePath: string | null } | null;
}): string | null {
  return order.photos[0]?.path ?? order.pattern?.coverImagePath ?? null;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; assigned?: string; sort?: string }>;
}) {
  const { q, status, assigned, sort } = await searchParams;
  const search = normalizeSearch(q);

  const filters: Prisma.OrderWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { customer: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  // Estado libre en BD (String): solo se filtra con valores válidos conocidos.
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    filters.push({ status });
  }
  if (assigned) filters.push({ assignedToId: assigned });
  const where = filters.length > 0 ? { AND: filters } : undefined;

  const orderBy: Prisma.OrderOrderByWithRelationInput[] =
    sort === "due"
      ? [{ dueDate: "asc" }, { createdAt: "desc" }]
      : sort === "priceDesc"
        ? [{ priceCents: "desc" }]
        : sort === "priceAsc"
          ? [{ priceCents: "asc" }]
          : [{ createdAt: "desc" }];

  const [t, locale, format, orders, users] = await Promise.all([
    getTranslations("Orders"),
    getLocale(),
    getFormatter(),
    prisma.order.findMany({
      where,
      orderBy,
      include: {
        assignedTo: { select: { name: true } },
        photos: { where: { isCover: true }, take: 1 },
        pattern: { select: { coverImagePath: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const view = parseView(
    (await cookies()).get(viewCookieName(SECTION))?.value,
    "list",
  );

  const hasFilters = filters.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1-display">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {(orders.length > 0 || hasFilters) && (
            <ViewToggle section={SECTION} value={view} />
          )}
          <Button asChild>
            <Link href="/dashboard/pedidos/nuevo">
              <Plus className="size-4" />
              {t("add")}
            </Link>
          </Button>
        </div>
      </div>

      <ListSearch className="max-w-sm" />
      <OrderFilters users={users} />

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title={hasFilters ? t("noResultsTitle") : t("emptyTitle")}
          description={
            hasFilters ? t("noResultsDescription") : t("emptyDescription")
          }
          action={
            hasFilters ? undefined : { href: `${BASE_PATH}/nuevo`, label: t("add") }
          }
        />
      ) : view === "list" ? (
        <>
          {/* Escritorio: libro de pedidos; móvil: tarjetas apiladas. */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm sm:block">
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
                          <AssetImage
                            src={cover ? assetUrl(cover) : null}
                            alt=""
                            fallbackIcon={<Package className="size-4" />}
                            className="size-9 rounded-lg border object-cover"
                          />
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
                        <StatusBadge status={order.status} kind="order" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {order.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(order.priceCents, locale)}
                      </TableCell>
                      <TableCell>{order.assignedTo?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {order.dueDate
                          ? format.dateTime(order.dueDate, { dateStyle: "medium" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          viewHref={`${BASE_PATH}/${order.id}`}
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
          <div className="space-y-3 sm:hidden">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={{
                  id: order.id,
                  name: order.name,
                  customer: order.customer,
                  status: order.status,
                  quantity: order.quantity,
                  priceCents: order.priceCents,
                  assignedToName: order.assignedTo?.name ?? null,
                  dueDate: order.dueDate,
                  coverPath: orderCover(order),
                }}
                deleteAction={deleteOrder.bind(null, order.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={{
                id: order.id,
                name: order.name,
                customer: order.customer,
                status: order.status,
                quantity: order.quantity,
                priceCents: order.priceCents,
                assignedToName: order.assignedTo?.name ?? null,
                dueDate: order.dueDate,
                coverPath: orderCover(order),
              }}
              deleteAction={deleteOrder.bind(null, order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
