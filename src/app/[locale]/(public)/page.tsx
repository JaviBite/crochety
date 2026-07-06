import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ORDER_STATUSES } from "@/lib/validations";

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  // Portfolio de solo lectura: fotos de pedidos marcados como públicos y ya
  // terminados/cobrados. Sin precios ni datos de clientes.
  const photos = await prisma.orderPhoto.findMany({
    where: {
      order: {
        isPublic: true,
        status: { in: [...PUBLIC_ORDER_STATUSES] },
      },
    },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { name: true } } },
  });

  return (
    <div className="space-y-10">
      <section className="pt-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Zgz Stitches
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("tagline")}</p>
      </section>

      {photos.length === 0 ? (
        <section className="mx-auto max-w-md rounded-2xl border border-dashed bg-card px-8 py-16 text-center shadow-sm">
          <div className="text-5xl">🧶</div>
          <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("emptyDescription")}</p>
        </section>
      ) : (
        // Cuadrícula tipo Pinterest con CSS columns: cada foto conserva su
        // proporción y fluye en columnas según el ancho disponible.
        <section className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>figure]:mb-4">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="break-inside-avoid overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              {/* Imágenes servidas en runtime desde el volumen de uploads */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${photo.path}`}
                alt={photo.order.name}
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
