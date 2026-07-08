import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "../../user-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!isAdmin(session)) redirect({ href: "/dashboard", locale });

  const [t, user] = await Promise.all([
    getTranslations("Users"),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("editTitle")}</h1>
        <p className="text-muted-foreground">{t("editDescription")}</p>
      </div>
      <UserForm user={user} isSelf={user.id === session!.user.id} />
    </div>
  );
}
