import { BookOpen, Boxes, ExternalLink, FileDown, FileText, MapPin, Package, ScrollText } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AssetImage, } from "@/components/asset-image";
import { RowActions } from "@/components/dashboard/row-actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OrderStatusSelect } from "@/components/dashboard/order-status-select";
import { TagChips } from "@/components/dashboard/tag-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { assetUrl } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

type DeleteResult = { error?: string } | undefined | void;

/* ---------------------------------------------------------------------------
   Tarjetas compartidas de los listados en cuadrícula (antes inline en cada
   page.tsx). Estructura común: portada a proporción fija con badge de estado
   arriba a la izquierda, acciones en una píldora arriba a la derecha (fuera
   del enlace de portada para no anidar interactivos), título enlazado y
   metadatos en el pie.
--------------------------------------------------------------------------- */

/** Píldora-overlay para las acciones de fila sobre la portada. */
function CoverActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="absolute right-2 top-2 rounded-xl bg-card/90 p-0.5 shadow-sm backdrop-blur-sm">
      {children}
    </div>
  );
}

/** Chip-enlace compacto para acciones secundarias del pie de tarjeta. */
const FOOTER_CHIP =
  "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** Enlaces de exportación de la versión estandarizada (misma ruta para todo). */
export function ExportLinks({ id }: { id: string }) {
  return (
    <>
      <a
        href={`/api/patterns/${id}/export?format=md`}
        aria-label="Markdown"
        title="Markdown"
        className={FOOTER_CHIP}
      >
        <FileDown className="size-3.5" />
        MD
      </a>
      <a
        href={`/api/patterns/${id}/export?format=epub`}
        aria-label="EPUB"
        title="EPUB"
        className={FOOTER_CHIP}
      >
        <BookOpen className="size-3.5" />
        EPUB
      </a>
    </>
  );
}

/** Enlaces al origen del patrón: fichero, web y exports (listado y tarjeta). */
export async function PatternSourceLinks({
  pattern,
}: {
  pattern: {
    id: string;
    filePath: string | null;
    externalUrl: string | null;
    /** Equivalente a standardizedContent != null (aiStatus DONE/MULTIPLE):
        evita arrastrar el JSON grande a los listados. */
    hasStandardized: boolean;
  };
}) {
  const t = await getTranslations("Patterns");
  return (
    <>
      {pattern.filePath && (
        <a
          href={assetUrl(pattern.filePath)}
          target="_blank"
          rel="noreferrer noopener"
          className={FOOTER_CHIP}
        >
          <FileText className="size-3.5" />
          {t("viewFile")}
        </a>
      )}
      {pattern.externalUrl && (
        <a
          href={pattern.externalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={FOOTER_CHIP}
        >
          <ExternalLink className="size-3.5" />
          {t("viewLink")}
        </a>
      )}
      {pattern.hasStandardized && <ExportLinks id={pattern.id} />}
      {!pattern.filePath && !pattern.externalUrl && (
        <span className="text-xs">{t("noSource")}</span>
      )}
    </>
  );
}

/** Badge-enlace que abre el enlace del material (tienda/proveedor). */
export function MaterialLinkBadge({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="w-fit"
      aria-label={label}
    >
      <Badge
        variant="outline"
        className="cursor-pointer gap-1 font-normal hover:bg-accent"
      >
        <ExternalLink className="size-3" />
        {label}
      </Badge>
    </a>
  );
}

export type PatternCardData = {
  id: string;
  title: string;
  aiStatus: string;
  coverImagePath: string | null;
  filePath: string | null;
  externalUrl: string | null;
  hasStandardized: boolean;
  tags: { name: string }[];
};

const PATTERNS_PATH = "/dashboard/patrones";

export async function PatternCard({
  pattern,
  deleteAction,
}: {
  pattern: PatternCardData;
  deleteAction: () => Promise<DeleteResult>;
}) {
  return (
    <Card className="group cozy-card overflow-hidden rounded-2xl pt-0 shadow-sm">
      <div className="relative">
        <Link
          href={`${PATTERNS_PATH}/${pattern.id}`}
          aria-label={pattern.title}
          className="block"
        >
          <AssetImage
            src={pattern.coverImagePath ? assetUrl(pattern.coverImagePath) : null}
            alt={pattern.title}
            fallbackIcon={<ScrollText className="size-8" />}
            className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        <div className="absolute left-2 top-2">
          <StatusBadge status={pattern.aiStatus} kind="patternAi" overlay />
        </div>
        <CoverActions>
          <RowActions
            viewHref={`${PATTERNS_PATH}/${pattern.id}`}
            editHref={`${PATTERNS_PATH}/editar/${pattern.id}`}
            deleteAction={deleteAction}
            entityName={pattern.title}
          />
        </CoverActions>
      </div>
      <CardContent className="space-y-2 py-3 text-sm text-muted-foreground">
        <Link
          href={`${PATTERNS_PATH}/${pattern.id}`}
          className="line-clamp-2 font-heading text-base font-medium leading-snug text-foreground hover:underline"
        >
          {pattern.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <PatternSourceLinks pattern={pattern} />
        </div>
        <TagChips tags={pattern.tags} basePath={PATTERNS_PATH} />
      </CardContent>
    </Card>
  );
}

export type MaterialCardData = {
  id: string;
  name: string;
  category: string;
  colorHex: string | null;
  photoPath: string | null;
  link: string | null;
  stock: number;
  priceCents: number;
  brand: string | null;
  fiberType: string | null;
  weight: string | null;
  location: string | null;
  tags: { name: string }[];
};

const MATERIALS_PATH = "/dashboard/materiales";

export async function MaterialCard({
  material,
  deleteAction,
  locale,
}: {
  material: MaterialCardData;
  deleteAction: () => Promise<DeleteResult>;
  locale: string;
}) {
  const [t, tCategory] = await Promise.all([
    getTranslations("Materials"),
    getTranslations("MaterialCategory"),
  ]);
  return (
    <Card className="group cozy-card overflow-hidden rounded-2xl pt-0 shadow-sm">
      <div className="relative">
        <Link
          href={`${MATERIALS_PATH}/${material.id}`}
          aria-label={material.name}
          className="block"
        >
          <AssetImage
            src={material.photoPath ? assetUrl(material.photoPath) : null}
            alt={material.name}
            fallbackColor={material.colorHex}
            fallbackIcon={<Boxes className="size-8" />}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        <div className="absolute left-2 top-2">
          <Badge variant="secondary" className="shadow-sm">
            {tCategory(material.category)}
          </Badge>
        </div>
        <CoverActions>
          <RowActions
            viewHref={`${MATERIALS_PATH}/${material.id}`}
            editHref={`${MATERIALS_PATH}/editar/${material.id}`}
            deleteAction={deleteAction}
            entityName={material.name}
          />
        </CoverActions>
      </div>
      <CardContent className="space-y-1.5 py-3 text-sm text-muted-foreground">
        <Link
          href={`${MATERIALS_PATH}/${material.id}`}
          className="flex items-start gap-2 font-heading text-base font-medium leading-snug text-foreground hover:underline"
        >
          {material.colorHex && (
            <span
              aria-hidden
              className="mt-1 size-3.5 shrink-0 rounded-full border"
              style={{ backgroundColor: material.colorHex }}
            />
          )}
          <span className="line-clamp-2">{material.name}</span>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <span className="tabular-nums">
            {t("inStock", { count: material.stock })} ·{" "}
            {formatCents(material.priceCents, locale)}
          </span>
          {material.link && (
            <MaterialLinkBadge href={material.link} label={t("fieldLink")} />
          )}
        </div>
        {(material.brand || material.fiberType || material.weight) && (
          <p className="text-xs">
            {[material.brand, material.fiberType, material.weight]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {material.location && (
          <p className="flex items-center gap-1 text-xs">
            <MapPin className="size-3" />
            {material.location}
          </p>
        )}
        <TagChips tags={material.tags} basePath={MATERIALS_PATH} />
      </CardContent>
    </Card>
  );
}

export type OrderCardData = {
  id: string;
  name: string;
  customer: string | null;
  status: string;
  quantity: number;
  priceCents: number;
  assignedToName: string | null;
  dueDate: Date | null;
  /** Foto propia del pedido o portada del patrón asociado (resuelta fuera). */
  coverPath: string | null;
  /** dueDate pasada y aún no cobrado (resaltado al ordenar por entrega). */
  overdue?: boolean;
};

const ORDERS_PATH = "/dashboard/pedidos";

export async function OrderCard({
  order,
  deleteAction,
}: {
  order: OrderCardData;
  deleteAction: () => Promise<DeleteResult>;
}) {
  const [t, locale, format] = await Promise.all([
    getTranslations("Orders"),
    getLocale(),
    getFormatter(),
  ]);
  return (
    <Card className="group cozy-card overflow-hidden rounded-2xl pt-0 shadow-sm">
      <div className="relative">
        <Link
          href={`${ORDERS_PATH}/${order.id}`}
          aria-label={order.name}
          className="block"
        >
          <AssetImage
            src={order.coverPath ? assetUrl(order.coverPath) : null}
            alt={order.name}
            fallbackIcon={<Package className="size-8" />}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        <div className="absolute left-2 top-2">
          <OrderStatusSelect id={order.id} status={order.status} overlay />
        </div>
        <CoverActions>
          <RowActions
            viewHref={`${ORDERS_PATH}/${order.id}`}
            editHref={`${ORDERS_PATH}/editar/${order.id}`}
            deleteAction={deleteAction}
            entityName={order.name}
          />
        </CoverActions>
      </div>
      <CardContent className="space-y-1.5 py-3 text-sm text-muted-foreground">
        <Link
          href={`${ORDERS_PATH}/${order.id}`}
          className="line-clamp-2 font-heading text-base font-medium leading-snug text-foreground hover:underline"
        >
          {order.name}
          {order.customer && (
            <span className="block text-xs font-normal text-muted-foreground">
              {t("forCustomer", { name: order.customer })}
            </span>
          )}
        </Link>
        <div className="flex items-center justify-between gap-2">
          <span className="tabular-nums">
            {order.quantity} · {formatCents(order.priceCents, locale)}
          </span>
          {order.assignedToName && (
            <span className="truncate text-xs">{order.assignedToName}</span>
          )}
        </div>
        {order.dueDate && (
          <p
            className={cn(
              "text-xs",
              order.overdue && "font-medium text-amber-600 dark:text-amber-400",
            )}
          >
            {format.dateTime(order.dueDate, { dateStyle: "medium" })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
