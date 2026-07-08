import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, isAdmin } from "@/lib/auth";
import { UserForm } from "../user-form";

export default async function NewUserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!isAdmin(session)) redirect({ href: "/dashboard", locale });

  const t = await getTranslations("Users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <UserForm />
    </div>
  );
}
