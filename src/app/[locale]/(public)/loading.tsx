import { Skeleton } from "@/components/ui/skeleton";

// Fallback de Suspense de la galería pública: el hero y unos huecos de
// mampostería aparecen al instante mientras se consultan los pedidos.
export default function PublicLoading() {
  return (
    <div className="space-y-10" aria-busy="true">
      <section className="pt-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Zgz Stitches
        </h1>
        <Skeleton className="mx-auto mt-4 h-6 w-64" />
      </section>
      <section className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {[52, 40, 64, 44, 56, 48, 60, 36].map((height, index) => (
          <Skeleton
            key={index}
            className="break-inside-avoid rounded-xl"
            style={{ height: `${height * 4}px` }}
          />
        ))}
      </section>
    </div>
  );
}
