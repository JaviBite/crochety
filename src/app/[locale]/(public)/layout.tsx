import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/theme/locale-switcher";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Link } from "@/i18n/navigation";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("Landing");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🧶 Zgz Stitches
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Zgz Stitches</span>
          {/* Enlace discreto al panel de gestión */}
          <Link href="/login" className="transition-colors hover:text-foreground">
            {t("login")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
