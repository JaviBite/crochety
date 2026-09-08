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
    <div className="relative mx-auto flex max-w-sm flex-col justify-center py-20">
      {/* Fondo decorado sutil: blob del acento + patrón de puntadas en CSS */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <Card className="rounded-2xl shadow-sm">
        <div
          aria-hidden
          className="stitch-pattern h-2 rounded-t-2xl text-foreground/8"
        />
        <CardHeader className="text-center">
          <div className="animate-bounce-slow text-4xl">🧶</div>
          <CardTitle className="mt-2 font-heading text-2xl">{t("title")}</CardTitle>
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
