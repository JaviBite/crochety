import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardNav } from "@/components/dashboard/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { AccentPicker } from "@/components/theme/accent-picker";
import { LocaleSwitcher } from "@/components/theme/locale-switcher";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link, redirect } from "@/i18n/navigation";
import { auth, isAdmin, signOut } from "@/lib/auth";
import { getWorkshopSettings } from "@/lib/settings";

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  // Defensa en profundidad: el proxy ya protege /dashboard, pero el layout
  // vuelve a comprobar la sesión por si se llega por otra vía.
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
  }

  const [t, workshop] = await Promise.all([
    getTranslations("Nav"),
    getWorkshopSettings(),
  ]);
  const admin = isAdmin(session);
  const userName = session!.user.name ?? "";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar de escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <Link href="/dashboard" className="px-3 text-lg font-bold tracking-tight">
          🧶 {workshop.name}
        </Link>
        <div className="mt-8 flex-1">
          <DashboardNav isAdmin={admin} />
        </div>
        <Separator className="my-4" />
        <div className="flex items-center gap-3 px-1">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm font-medium">{userName}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label={t("signOut")}
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1">
          <ModeToggle />
          <AccentPicker />
          <LocaleSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior en móvil */}
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <MobileNav brand={workshop.name} isAdmin={admin} />
            <span className="font-bold">🧶 {workshop.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <AccentPicker />
            <LocaleSwitcher />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
