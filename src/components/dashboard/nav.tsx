"use client";

import {
  LayoutDashboard,
  Package,
  Receipt,
  Boxes,
  ScrollText,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

type NavItem = {
  href: string;
  key:
    | "home"
    | "orders"
    | "expenses"
    | "materials"
    | "patterns"
    | "profile"
    | "users"
    | "settings";
  icon: LucideIcon;
  adminOnly?: boolean;
};

const MAIN_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "home", icon: LayoutDashboard },
  { href: "/dashboard/pedidos", key: "orders", icon: Package },
  { href: "/dashboard/gastos", key: "expenses", icon: Receipt },
  { href: "/dashboard/materiales", key: "materials", icon: Boxes },
  { href: "/dashboard/patrones", key: "patterns", icon: ScrollText },
];

// Cuenta y administración: Perfil para todos; Usuarios y Ajustes solo admin.
const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/dashboard/perfil", key: "profile", icon: UserRound },
  { href: "/dashboard/usuarios", key: "users", icon: Users, adminOnly: true },
  { href: "/dashboard/ajustes", key: "settings", icon: Settings, adminOnly: true },
];

export function DashboardNav({
  isAdmin = false,
  onNavigate,
}: {
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  function renderItems(items: NavItem[]) {
    return items.map(({ href, key, icon: Icon }) => {
      const active =
        href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {t(key)}
        </Link>
      );
    });
  }

  const accountItems = ACCOUNT_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <nav className="flex flex-col gap-1">
      {renderItems(MAIN_ITEMS)}
      <div role="separator" className="my-2 border-t" />
      {renderItems(accountItems)}
    </nav>
  );
}
