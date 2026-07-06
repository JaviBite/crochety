<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Crochety — Zgz Stitches

Plataforma para un pequeño negocio de crochet/amigurumis de 2 personas: pedidos,
gastos, balance estilo Splitwise, inventario de materiales y patrones
estandarizados por IA. Galería pública en `/`, panel protegido en `/dashboard`.
Premisa: **cozy minimalism, cero sobre-ingeniería** — SQLite embebido, un solo
contenedor Docker, sin servicios externos.

## Stack (versiones importantes)

- **Next.js 16** App Router + TS. El middleware se llama **`src/proxy.ts`** (convención Next 16).
- **Prisma 7** + SQLite vía driver adapter `@prisma/adapter-better-sqlite3`. El cliente se genera en `src/generated/prisma` (gitignored, `postinstall` lo regenera). La URL de la BD vive en `prisma.config.ts`, NO en `schema.prisma`.
- **Auth.js v5 (next-auth beta)**: Credentials + JWT. Config dividida: `lib/auth.config.ts` (sin Prisma, la usa el proxy) y `lib/auth.ts` (con Prisma).
- **next-intl v4**: locales `es` (default, SIN prefijo) y `en` (`/en/...`), `localePrefix: "as-needed"`.
- **Tailwind v4 + shadcn/ui** (preset radix-nova) + next-themes.
- **Vercel AI SDK**: proveedor configurable por env (`AI_PROVIDER`: anthropic|openai|ollama).
- **Vitest + Testing Library**: tests colocados junto al código (`*.test.ts[x]`).

## Trampas conocidas (no re-aprender por las malas)

1. **NO envolver el proxy con el wrapper `auth()` de NextAuth**: rompe las respuestas de rewrite de next-intl (bucle de 307 en `/`). El proxy valida sesión con `getToken` de `next-auth/jwt`.
2. **SQLite no soporta enums ni Decimal de Prisma**: estados/categorías son `String` validados con las constantes zod de `src/lib/validations.ts`; el dinero va en **céntimos enteros** (`Int`), helpers en `src/lib/money.ts`.
3. **Navegación localizada**: usar SIEMPRE `Link`/`redirect`/`useRouter`/`usePathname` de `@/i18n/navigation` (no los de `next/*`)… con una excepción: tras `signIn` el login usa el router crudo de `next/navigation` porque el callbackUrl ya lleva prefijo.
4. **zod v4 + coerce**: `z.coerce.number()` convierte `null` a `0`; en uniones opcionales poner `z.null()` PRIMERO (ver `lib/forms.ts`).
5. **Selects opcionales (Radix)**: no admiten `value=""`; se usa el centinela `NONE_VALUE` de `lib/forms.ts`.
6. **`redirect()` de next-intl no está tipado como `never`**: en server actions hace falta un `return null` inalcanzable detrás.
7. **Ficheros subidos**: nunca por `public/` (no funciona en runtime con build standalone); se sirven por `/api/files/[...path]` con validación anti-traversal (`lib/files.ts`). Los `patterns/` requieren sesión.
8. **El acento de color** se persiste en la cookie `accent` y se lee en el layout servidor (`data-accent` en `<html>`) para evitar flash. Los 4 acentos viven en `globals.css`.
9. **Docker**: el runner NO lleva el node_modules completo; `/app/migrator` (etapa `migrator` del Dockerfile) contiene el CLI de Prisma + `docker/seed.cjs` (JS plano contra SQLite) para `migrate deploy` + seed en cada arranque.
10. **Si `npm ci` falla en Docker por lockfile desincronizado**: regenerar con `rm -rf node_modules package-lock.json && npm install`.

## Comandos

```bash
npm run dev          # desarrollo (puerto 3000)
npm run build        # build producción (output standalone)
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
npx eslint src       # lint
npm run db:migrate   # prisma migrate dev
npm run db:seed      # crea los 2 usuarios desde .env (USER1_*/USER2_*)
npm run db:studio    # inspector de BD
docker compose up -d --build   # despliegue (volúmenes ./data y ./uploads)
```

Credenciales de dev en `.env` (ver `.env.example`). Login en `/login`.

## Estructura

- `src/app/[locale]/(public)/` — galería pública + login
- `src/app/[locale]/dashboard/{pedidos,gastos,materiales,patrones}/` — cada sección: `page.tsx` (listado), `nuevo/page.tsx` (alta), `*-form.tsx` (client, `useActionState`), `actions.ts` (server action con guard de sesión + parser de `lib/forms.ts`)
- `src/lib/` — `prisma` (singleton), `auth`, `forms` (parsers FormData→datos), `files` (uploads), `money`, `validations`, `theme`, `ai/` (provider multi-LLM + contrato del patrón estandarizado)
- `messages/{es,en}.json` — TODA cadena de UI pasa por aquí (ambos ficheros siempre a la vez)
- `docker/` — entrypoint, seed de producción, config Prisma del contenedor

## Convenciones

- UI en los dos idiomas siempre: cada texto nuevo se añade a `messages/es.json` **y** `messages/en.json`.
- Server actions: guard `await auth()` al principio, devolver `{ error }` (nunca lanzar por validación), `revalidatePath("/", "layout")` + `redirect` i18n al terminar.
- Tests: la lógica nueva (parsers, helpers, componentes con lógica) lleva test unitario colocado al lado.
- Verificación visual: script Playwright de referencia en el scratchpad de sesión; capturar escritorio (1280×800) y móvil (390×844).

## Pendiente (roadmap)

- Editar/borrar en las 4 secciones (hoy solo alta + listado).
- Apartado de perfil para modificar perfil de usuario
- Apartado gestor usuarios para el admin (premite crea usuarios aqui)
- Calculadora de precio sugerido por materiales del pedido (`OrderMaterial` ya existe).
- Balance "quién debe a quién" fino en el dashboard.
- colorthief para sugerir `colorHex` desde la foto del material.
- Pipeline completo del agente IA de patrones: extracción de texto (unpdf/mammoth) + `standardizePattern()` (ya funcional dado el texto) + render del JSON estandarizado.
- Editor de patrones online para los esntadarizados
