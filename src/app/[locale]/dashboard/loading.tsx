import { Skeleton } from "@/components/ui/skeleton";

// Fallback de Suspense para todas las secciones del dashboard: la navegación
// pinta el esqueleto al instante mientras el servidor consulta la BD (Neon
// puede tardar en despertar); sin esto la página anterior se queda congelada.
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border p-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
