import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

// No hay registro público: los usuarios los crea el seed o un admin desde la app.
export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});

/**
 * ¿Es admin AHORA MISMO? El rol se lee de la BD, no del JWT: promocionar o
 * degradar a alguien (o que le borren la cuenta) surte efecto en la siguiente
 * petición, sin re-login. Una query por PK; nada de cache() para que los
 * guards de las server actions también vean el rol fresco.
 */
export async function isAdmin(session: Session | null): Promise<boolean> {
  const id = session?.user.id;
  if (!id) return false;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}
