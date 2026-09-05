import "server-only";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { parseBasicAuth } from "@/lib/opds";
import { prisma } from "@/lib/prisma";

// Autenticación del catálogo OPDS. Las apps lectoras (Moon+ Reader, Kybook,
// ReadEra…) no comparten cookies de sesión: usan HTTP Basic. Se aceptan las
// dos vías — la sesión de la web (misma pestaña) o Basic contra la tabla
// User (mismo email y contraseña del login).

export type OpdsPrincipal = { userId: string };

/** 401 con el reto Basic para que el lector pida credenciales. */
export function opdsUnauthorized(): Response {
  return new Response("No autorizado", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Crochety OPDS", charset="UTF-8"',
    },
  });
}

/** Sesión de la web o HTTP Basic con las credenciales de un usuario real. */
export async function authenticateOpds(
  request: Request,
): Promise<OpdsPrincipal | null> {
  const session = await auth();
  if (session?.user) {
    return { userId: session.user.id };
  }

  const basic = parseBasicAuth(request.headers.get("authorization"));
  if (!basic) return null;

  const user = await prisma.user.findUnique({
    where: { email: basic.email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) return null;
  if (!bcrypt.compareSync(basic.password, user.passwordHash)) return null;
  return { userId: user.id };
}
