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
      <section className="pt-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          {workshop.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {workshop.tagline ?? t("tagline")}
        </p>
      </section>

      {tiles.length === 0 ? (
        <section className="mx-auto max-w-md rounded-2xl border border-dashed bg-card px-8 py-16 text-center shadow-sm">
          <div className="text-5xl">🧶</div>
          <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("emptyDescription")}</p>
        </section>
      ) : (
        // Cuadrícula tipo Pinterest con CSS columns: cada foto conserva su
        // proporción y fluye en columnas según el ancho disponible.
        <section className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>figure]:mb-4">
          {tiles.map((tile) => (
            <figure
              key={tile.key}
              className="break-inside-avoid overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              {/* Imágenes servidas en runtime por el proxy /api/files */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${tile.path}`}
                alt={tile.name}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </figure>
          ))}
        </section>
      )}
    </div>
  );
}
