import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("Login");

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="text-center">
          <div className="text-4xl">🧶</div>
          <CardTitle className="mt-2 text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
      <Link
        href="/"
        className="mt-6 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
