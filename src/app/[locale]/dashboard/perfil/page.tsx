import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const [t, tRole, session] = await Promise.all([
    getTranslations("Profile"),
    getTranslations("UserRole"),
    auth(),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: session?.user.id ?? "" },
    select: { name: true, email: true, role: true },
  });
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <Badge variant="secondary">
            {tRole(user.role === "ADMIN" ? "ADMIN" : "USER")}
          </Badge>
        </div>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <ProfileForm user={{ name: user.name, email: user.email }} />
    </div>
  );
}
