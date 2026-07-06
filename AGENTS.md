<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Crochety — Zgz Stitches

Plataforma para un pequeño negocio de crochet/amigurumis de 2 personas: pedidos,
gastos, balance estilo Splitwise, inventario de materiales y patrones
estandarizados por IA. Galería pública en `/`, panel protegido en `/dashboard`.
Premisa: **cozy minimalism, cero sobre-ingeniería** — desplegado gratis en
Vercel + Neon Postgres + Vercel Blob (guía en `deploy/README.md`).

## Stack (versiones importantes)

- **Next.js 16** App Router + TS. El middleware se llama **`src/proxy.ts`** (convención Next 16).
- **Prisma 7** + Postgres (Neon) vía driver adapter `@prisma/adapter-pg`. El cliente se genera en `src/generated/prisma` (gitignored, `postinstall` lo regenera). La URL de la BD vive en `prisma.config.ts`, NO en `schema.prisma`.
- **Auth.js v5 (next-auth beta)**: Credentials + JWT. Config dividida: `lib/auth.config.ts` (sin Prisma, la usa el proxy) y `lib/auth.ts` (con Prisma).
- **next-intl v4**: locales `es` (default, SIN prefijo) y `en` (`/en/...`), `localePrefix: "as-needed"`.
- **Tailwind v4 + shadcn/ui** (preset radix-nova) + next-themes.
- **Vercel AI SDK**: proveedor configurable por env (`AI_PROVIDER`: anthropic|openai|openrouter|ollama). En producción: openrouter con el router gratuito `openrouter/free`.
- **Vitest + Testing Library**: tests colocados junto al código (`*.test.ts[x]`).

## Trampas conocidas (no re-aprender por las malas)

1. **NO envolver el proxy con el wrapper `auth()` de NextAuth**: rompe las respuestas de rewrite de next-intl (bucle de 307 en `/`). El proxy valida sesión con `getToken` de `next-auth/jwt`.
2. **Nada de enums ni Decimal de Prisma** (herencia de SQLite, se mantiene por simplicidad): estados/categorías son `String` validados con las constantes zod de `src/lib/validations.ts`; el dinero va en **céntimos enteros** (`Int`), helpers en `src/lib/money.ts`.
3. **Navegación localizada**: usar SIEMPRE `Link`/`redirect`/`useRouter`/`usePathname` de `@/i18n/navigation` (no los de `next/*`)… con una excepción: tras `signIn` el login usa el router crudo de `next/navigation` porque el callbackUrl ya lleva prefijo.
4. **zod v4 + coerce**: `z.coerce.number()` convierte `null` a `0`; en uniones opcionales poner `z.null()` PRIMERO (ver `lib/forms.ts`).
5. **Selects opcionales (Radix)**: no admiten `value=""`; se usa el centinela `NONE_VALUE` de `lib/forms.ts`.
6. **`redirect()` de next-intl no está tipado como `never`**: en server actions hace falta un `return null` inalcanzable detrás.
7. **Ficheros subidos**: driver dual en `lib/files.ts` — Vercel Blob si hay `BLOB_READ_WRITE_TOKEN` (producción), disco local (`UPLOAD_DIR`, `./uploads`) si no (dev offline). En la BD se persiste el pathname relativo tipo `orders/uuid.jpg` en ambos casos. Se sirven SIEMPRE vía el proxy `/api/files/[...path]` (la URL interna no llega al cliente): los `patterns/` requieren sesión.
8. **El acento de color** se persiste en la cookie `accent` y se lee en el layout servidor (`data-accent` en `<html>`) para evitar flash. Los 4 acentos viven en `globals.css`.
9. **Dos URLs de BD (Neon)**: el runtime usa `DATABASE_URL` (pooled/pgbouncer) vía el adapter; el CLI de Prisma (migrate/seed/studio) usa `DATABASE_URL_UNPOOLED` (directa) — ya resuelto en `prisma.config.ts`. Las migraciones de producción las aplica el script `vercel-build` en cada deploy.

## Comandos

```bash
npm run dev          # desarrollo (puerto 3000)
npm run build        # build producción
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
npx eslint src       # lint
npm run db:migrate   # prisma migrate dev
npm run db:seed      # crea los 2 usuarios desde .env (USER1_*/USER2_*)
npm run db:studio    # inspector de BD
# despliegue: push a master → Vercel (migra + build vía script vercel-build)
```

Credenciales de dev en `.env` (ver `.env.example`). Login en `/login`.

## Estructura

- `src/app/[locale]/(public)/` — galería pública + login
- `src/app/[locale]/dashboard/{pedidos,gastos,materiales,patrones}/` — cada sección: `page.tsx` (listado), `nuevo/page.tsx` (alta), `*-form.tsx` (client, `useActionState`), `actions.ts` (server action con guard de sesión + parser de `lib/forms.ts`)
- `src/lib/` — `prisma` (singleton), `auth`, `forms` (parsers FormData→datos), `files` (uploads), `money`, `validations`, `theme`, `ai/` (provider multi-LLM + contrato del patrón estandarizado)
- `messages/{es,en}.json` — TODA cadena de UI pasa por aquí (ambos ficheros siempre a la vez)
- `deploy/README.md` — guía de despliegue (Vercel + Neon + Blob + OpenRouter)

## Convenciones

- UI en los dos idiomas siempre: cada texto nuevo se añade a `messages/es.json` **y** `messages/en.json`.
- Server actions: guard `await auth()` al principio, devolver `{ error }` (nunca lanzar por validación), `revalidatePath("/", "layout")` + `redirect` i18n al terminar.
- Tests: la lógica nueva (parsers, helpers, componentes con lógica) lleva test unitario colocado al lado.
- Verificación visual: script Playwright de referencia en el scratchpad de sesión; capturar escritorio (1280×800) y móvil (390×844).

## Pendiente (roadmap)

Organizado en fases para implementación incremental. `✅` = ya hecho.

### Fase A — Fundamentos transversales ✅

- ✅ **CRUD completo**: editar/borrar en las 4 secciones. Cada `*-form.tsx` es
  create/edit compartido (recibe la entidad opcional), con `editar/[id]/page.tsx`,
  acciones `updateX`/`deleteX` y `RowActions` (editar + borrar con `AlertDialog`)
  en los listados. `deleteUpload()` en `lib/files.ts` limpia ficheros huérfanos.
- ✅ **Vistas lista/cuadrícula**: `ViewToggle` + `lib/view.ts` (cookie por sección,
  leída en servidor sin flash). Aplicado a materiales y patrones (cuadrícula↔lista)
  y pedidos (lista↔cuadrícula). Gastos se queda como libro contable (tabla) por
  ser un registro puramente tabular.
- ✅ **Tags/keywords** en materiales y patrones: modelo `Tag` normalizado (m2m
  implícita Prisma), `TagInput` (chips), chips + filtro `?tag=` en los listados.
  Helpers en `lib/tags.ts`.

### Fase B — Imágenes y color ✅ (falta foto de patrón)

- ✅ **Color dominante automático** del material desde la foto: extracción en cliente
  con Canvas (`lib/color.ts`), corregible con cuentagotas sobre la propia imagen +
  selector de color (`materiales/material-color-field.tsx`).
- ✅ **Foto de pedido terminado** con fallback a la portada del patrón asociado
  (listado y cuadrícula de pedidos + galería pública).
- **Foto de patrón**: opcional al alta; si no se sube, derivarla del origen
  (primera página del PDF / `og:image` de la web). Se apoya en la Fase D.

### Fase C — Agente IA de gastos (multi-producto) ✅ (falta persistir fotos)

- ✅ **Esquema multi-producto**: `Expense` (recibo: fecha, tienda, quién paga,
  envío, total) + `ExpenseItem[]` (`→ Material` opcional) + `ExpensePhoto[]`.
  Migración `expense_items` aplicada en Neon.
- ✅ **Captura/texto → gasto por IA**: `lib/ai/extract-expense.ts` (contrato +
  visión + mapeo a céntimos) + server action `extractExpenseAction`; el formulario
  rellena las líneas a partir del texto/imagen.
- ✅ **Recorte en cliente** antes de la IA (`lib/crop.ts` + `components/form/image-cropper.tsx`).
- ✅ **Checkbox "añadir a materiales"** por línea (`ExpenseItem → Material`, en
  transacción; categoría por defecto `OTRO`).
- **Pendiente**: persistir las **imágenes de compra** (`ExpensePhoto`): subirlas a
  Blob y la opción "por link y que se guarde" (falta un upload kind `expenses` en
  `lib/files.ts` + servirlas privadas en `/api/files`). Nota: al editar un gasto se
  recrean las líneas, así que el enlace `ExpenseItem.materialId` se pierde (el
  material sigue en inventario); las casillas "añadir a materiales" salen desmarcadas
  en edición para no duplicar.

### Fase D — IA de patrones y extras

- **Pipeline IA de patrones**: extracción de texto (unpdf para PDF / mammoth para
  DOCX / fetch para web) + `standardizePattern()` (ya funcional dado el texto) +
  render del JSON estandarizado + orquestación de `aiStatus`
  (PENDING→PROCESSING→DONE/ERROR).
- **Editor de patrones online** para los estandarizados.
- **Permitir añadir patrones en batch** a partir de varios ficheros
- **Calculadora de precio sugerido** por materiales del pedido (`OrderMaterial` ya
  existe).
- **Perfil de usuario**: apartado para modificar el propio perfil.
- **Gestor de usuarios** (admin): crear usuarios desde la app. Introduce el rol
  `admin` en `User`.
- **Panel de administración / ajustes** (solo admin): configuración editable en
  runtime que hoy vive en `.env`: proveedor y modelo de IA (`AI_PROVIDER` /
  `AI_MODEL`, claves API enmascaradas y nunca expuestas al cliente), datos del
  taller (nombre/tagline de la landing, hoy hardcodeados), idioma y acento por
  defecto, y ajustes de la galería pública. Requiere un modelo `Setting`
  (clave-valor) leído en servidor con *fallback* a env, de forma que
  `getAiProvider()`/`getModel()` consulten la BD primero.
- **Balance fino "quién debe a quién"** en el dashboard.

### Ya hecho

- ✅ Galería pública tipo mampostería (Pinterest) con CSS columns en `/`.
