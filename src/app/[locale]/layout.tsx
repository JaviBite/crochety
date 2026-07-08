import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Geist_Mono, Nunito } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getDefaultAccent, getWorkshopSettings } from "@/lib/settings";
import { parseAccent } from "@/lib/theme";
import "../globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getWorkshopSettings();
  return {
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description: "Amigurumis y crochet hechos a mano · Handmade crochet",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const cookieStore = await cookies();
  // La cookie del visitante manda; sin cookie, el acento por defecto de ajustes.
  const accentCookie = cookieStore.get("accent")?.value;
  const accent = accentCookie
    ? parseAccent(accentCookie)
    : await getDefaultAccent();

  return (
    <html
      lang={locale}
      data-accent={accent}
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
