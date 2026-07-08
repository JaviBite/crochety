import type { NextAuthConfig } from "next-auth";

// Configuración base SIN dependencias de Prisma/Node: la importa también el
// proxy (src/proxy.ts), donde solo hace falta validar el JWT de la cookie.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role ?? "USER";
      }
      // El perfil llama a updateSession() tras guardar cambios: se refresca
      // el nombre/correo del JWT sin obligar a re-loguearse.
      if (trigger === "update" && session) {
        const updated = (session as { user?: { name?: string; email?: string } })
          .user;
        if (updated?.name) token.name = updated.name;
        if (updated?.email) token.email = updated.email;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.role = token.role ?? "USER";
      return session;
    },
  },
} satisfies NextAuthConfig;
