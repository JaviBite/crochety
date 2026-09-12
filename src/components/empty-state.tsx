import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  /** CTA opcional (enlace) bajo la descripción; la galería pública la usa para
      llevar al visitante a la mampostería/login sin depender del dashboard. */
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-8 py-16 text-center shadow-sm">
      {icon}
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
