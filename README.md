# 🧶 Crochety — Zgz Stitches

Plataforma para gestionar nuestro pequeño negocio de crochet/amigurumis: pedidos,
gastos, balances, inventario de materiales y patrones estandarizados por IA.
Portfolio público estilo Pinterest en `/`, panel de gestión protegido en `/dashboard`.

## Stack

- **Next.js 16** (App Router, TypeScript, `output: standalone`)
- **Tailwind CSS v4 + shadcn/ui** — modo claro/oscuro + 4 acentos (menta, lavanda, melocotón, cielo)
- **next-intl** — UI bilingüe: español (por defecto, sin prefijo) e inglés (`/en`)
- **SQLite + Prisma 7** (adapter better-sqlite3) — un solo fichero en `data/`
- **Auth.js v5** — login con credenciales, sesión JWT, registro deshabilitado
- **Vercel AI SDK** — proveedor LLM configurable: Anthropic (por defecto), OpenAI u Ollama

## Desarrollo

```bash
cp .env.example .env        # rellena AUTH_SECRET y los USER1_/USER2_
npm install                 # postinstall ejecuta prisma generate
npx prisma migrate dev      # crea data/crochety.db
npm run db:seed             # crea los 2 usuarios del .env
npm run dev                 # http://localhost:3000
```

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

## Despliegue con Docker

```bash
cp .env.example .env        # AUTH_SECRET real + credenciales de usuarios
docker compose up --build -d
```

El contenedor aplica las migraciones y siembra los usuarios en cada arranque
(idempotente). Datos persistentes en el host:

- `./data/` → base de datos SQLite
- `./uploads/` → fotos y PDFs de patrones

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
docker/                      # entrypoint, seed de producción, config prisma
messages/                    # es.json, en.json
```
