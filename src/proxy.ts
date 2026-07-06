import { getToken } from "next-auth/jwt";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

// Proxy (antes "middleware") de Next 16: primero la protección de rutas
// (validando el JWT de la cookie con getToken — sin Prisma), después el
// routing de locale de next-intl. No se usa el wrapper auth() de NextAuth
// porque interfiere con las respuestas de rewrite de next-intl.
const intlMiddleware = createIntlMiddleware(routing);

const LOCALE_PREFIX = /^\/(es|en)(?=\/|$)/;

export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;

  // Ruta sin el prefijo de locale, para comparar una sola vez.
  const localeMatch = nextUrl.pathname.match(LOCALE_PREFIX);
  const prefix = localeMatch ? localeMatch[0] : "";
  const pathname = nextUrl.pathname.slice(prefix.length) || "/";

  const isDashboard = pathname.startsWith("/dashboard");
  const isLogin = pathname === "/login";

  if (isDashboard || isLogin) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie: nextUrl.protocol === "https:",
    });

    if (isDashboard && !token) {
      const loginUrl = new URL(`${prefix}/login`, nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return Response.redirect(loginUrl);
    }

    if (isLogin && token) {
      return Response.redirect(new URL(`${prefix}/dashboard`, nextUrl));
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Todo excepto /api, assets de Next y ficheros estáticos con extensión.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
