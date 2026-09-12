import { getTranslations } from "next-intl/server";
import { SiteHeader } from "./header";
import { Link } from "@/i18n/navigation";
import { getWorkshopSettings } from "@/lib/settings";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [t, workshop] = await Promise.all([
    getTranslations("Landing"),
    getWorkshopSettings(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader workshopName={workshop.name} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {workshop.name}
          </span>
          <p className="text-xs">{t("footerNote")}</p>
          {/* Enlace discreto al panel de gestión */}
          <Link href="/login" className="transition-colors hover:text-foreground">
            {t("login")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
