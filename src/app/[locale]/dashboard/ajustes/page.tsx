import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, isAdmin } from "@/lib/auth";
import { getSettingsSnapshot } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!isAdmin(session)) redirect({ href: "/dashboard", locale });

  const [t, snapshot] = await Promise.all([
    getTranslations("Settings"),
    getSettingsSnapshot(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <SettingsForm snapshot={snapshot} />
    </div>
  );
}
