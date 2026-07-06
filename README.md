# 🧶 Crochety — Zgz Stitches

Plataforma para gestionar nuestro pequeño negocio de crochet/amigurumis: pedidos,
gastos, balances, inventario de materiales y patrones estandarizados por IA.
Portfolio público estilo Pinterest en `/`, panel de gestión protegido en `/dashboard`.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4 + shadcn/ui** — modo claro/oscuro + 4 acentos (menta, lavanda, melocotón, cielo)
- **next-intl** — UI bilingüe: español (por defecto, sin prefijo) e inglés (`/en`)
- **Postgres (Neon) + Prisma 7** (adapter pg)
- **Vercel Blob** — fotos y ficheros de patrones, servidos vía `/api/files`
- **Auth.js v5** — login con credenciales, sesión JWT, registro deshabilitado
- **Vercel AI SDK** — proveedor LLM configurable: Anthropic, OpenAI, OpenRouter u Ollama

## Desarrollo

```bash
cp .env.example .env        # rellena AUTH_SECRET, DATABASE_URL* y los USER1_/USER2_
npm install                 # postinstall ejecuta prisma generate
npx prisma migrate dev      # aplica migraciones a la BD de desarrollo
npm run db:seed             # crea los 2 usuarios del .env
npm run dev                 # http://localhost:3000
```

La BD de desarrollo puede ser un Postgres local (`docker run postgres`) o un
branch "dev" de Neon; los uploads necesitan `BLOB_READ_WRITE_TOKEN`
(`vercel env pull`). Detalles en [deploy/README.md](deploy/README.md).

- `/` galería pública (español) · `/en` en inglés
- `/login` acceso al panel · `/dashboard` protegido por sesión

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | crea/actualiza los 2 usuarios desde `.env` |
| `npm run db:studio` | inspector visual de la BD |
| `npm run test` | tests unitarios (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |

## Despliegue

Push a `master` → Vercel construye y despliega (el script `vercel-build`
aplica las migraciones antes del build). Base de datos en Neon y ficheros en
Vercel Blob, ambos gestionados desde el dashboard de Vercel. Guía completa
paso a paso en [deploy/README.md](deploy/README.md).

## Variables de entorno

Ver [.env.example](.env.example). Las claves de IA (`ANTHROPIC_API_KEY`, …) solo
se usan en el servidor; el proveedor y modelo se eligen con `AI_PROVIDER` y
`AI_MODEL` sin tocar código.

## Estructura

```
src/
├── app/[locale]/(public)/   # galería pública + login
├── app/[locale]/dashboard/  # zona protegida (pedidos, gastos, materiales, patrones)
├── app/api/                 # auth, subida y servicio de ficheros
├── components/              # ui (shadcn), theme, dashboard
├── i18n/                    # config next-intl (es/en)
├── lib/                     # prisma, auth, money, validations, files, ai/
└── proxy.ts                 # protección de rutas + routing de locale
prisma/                      # schema, migraciones, seed
deploy/                      # guía de despliegue (Vercel + Neon + Blob)
messages/                    # es.json, en.json
```
