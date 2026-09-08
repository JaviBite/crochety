import { AssetImage } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getWorkshopSettings } from "@/lib/settings";
import { PUBLIC_ORDER_STATUSES } from "@/lib/validations";

export default async function LandingPage() {
  const [t, workshop] = await Promise.all([
    getTranslations("Landing"),
    getWorkshopSettings(),
  ]);

  // Portfolio de solo lectura: pedidos públicos ya terminados/cobrados. Cada
  // pedido aporta sus fotos; si no tiene ninguna, la portada de su patrón
  // (fallback). Sin precios ni datos de clientes. Con la galería desactivada
  // en ajustes solo queda el hero con el estado vacío.
  const orders = workshop.galleryEnabled
    ? await prisma.order.findMany({
        where: {
          isPublic: true,
          status: { in: [...PUBLIC_ORDER_STATUSES] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          photos: { orderBy: { isCover: "desc" } },
          pattern: { select: { coverImagePath: true } },
        },
      })
    : [];

  const tiles = orders.flatMap((order) => {
    if (order.photos.length > 0) {
      return order.photos.map((photo) => ({
        key: photo.id,
        path: photo.path,
        name: order.name,
      }));
    }
    if (order.pattern?.coverImagePath) {
      return [
        { key: order.id, path: order.pattern.coverImagePath, name: order.name },
      ];
    }
    return [];
  });

  return (
    <div className="space-y-10">
      {/* Hero: blob suave del acento detrás del título y CTA ancla a la
          mampostería. El gradiente usa currentColor del acento activo. */}
      <section className="relative overflow-hidden pt-10 pb-6 text-center sm:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <h1 className="h1-display sm:text-5xl">{workshop.name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
          {workshop.tagline ?? t("tagline")}
        </p>
        {tiles.length > 0 && (
          <a
            href="#galeria"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.04]"
          >
            {t("galleryCta")}
          </a>
        )}
      </section>

      {tiles.length === 0 ? (
        <section className="mx-auto max-w-md py-6">
          <EmptyState
            icon={<span className="animate-bounce-slow text-5xl">🧶</span>}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        </section>
      ) : (
        // Cuadrícula tipo Pinterest con CSS columns: cada foto conserva su
        // proporción y fluye en columnas según el ancho disponible. Los tiles
        // aparecen al hacer scroll (<Reveal>) con stagger por índice.
        <section
          id="galeria"
          className="scroll-mt-24 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>div]:mb-4"
        >
          {tiles.map((tile, index) => (
            <Reveal
              key={tile.key}
              className="break-inside-avoid"
              delay={(index % 4) * 60}
            >
              <figure className="group relative overflow-hidden rounded-xl border bg-card shadow-sm">
                <AssetImage
                  src={assetUrl(tile.path)}
                  alt={tile.name}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-background/85 to-transparent px-3 pt-8 pb-3 text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="line-clamp-1">{tile.name}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </section>
      )}
    </div>
  );
}
