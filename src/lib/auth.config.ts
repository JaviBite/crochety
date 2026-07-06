import type { NextAuthConfig } from "next-auth";

// Configuración base SIN dependencias de Prisma/Node: la importa también el
// proxy (src/proxy.ts), donde solo hace falta validar el JWT de la cookie.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
