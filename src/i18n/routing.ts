import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // El español (idioma por defecto) no lleva prefijo: /, /login, /dashboard.
  // El inglés vive bajo /en.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
