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
7. **Ficheros subidos**: driver dual en `lib/files.ts` — Vercel Blob si hay `BLOB_READ_WRITE_TOKEN` (producción), disco local (`UPLOAD_DIR`, `./uploads`) si no (dev offline). Funciona con stores de Blob públicos **y privados** (el modo se autodetecta y memoriza; todas las operaciones van por pathname con `put`/`get`/`del`). En la BD se persiste el pathname relativo tipo `orders/uuid.jpg` en ambos casos. Se sirven SIEMPRE vía el proxy `/api/files/[...path]` (la URL interna no llega al cliente): los **documentos** (PDF/DOCX de `patterns/`) y las fotos de `expenses/` requieren sesión; las imágenes son públicas (la galería usa portadas de patrón como fallback de pedido) e inmutables (caché fuerte en navegador + CDN).
8. **El acento de color** se persiste en la cookie `accent` y se lee en el layout servidor (`data-accent` en `<html>`) para evitar flash. Los 4 acentos viven en `globals.css`.
9. **Dos URLs de BD (Neon)**: el runtime usa `DATABASE_URL` (pooled/pgbouncer) vía el adapter; el CLI de Prisma (migrate/seed/studio) usa `DATABASE_URL_UNPOOLED` (directa) — ya resuelto en `prisma.config.ts`. Las migraciones de producción las aplica el script `vercel-build` en cada deploy.
10. **Subidas grandes**: las server actions capan el body (`bodySizeLimit: "4mb"` en `next.config.ts`, justo bajo el tope de 4,5 MB de las funciones de Vercel). Los ficheros de patrón NO viajan por la action: el formulario los sube antes a `/api/uploads` y la action recibe solo el pathname (mismo esquema que las fotos de gastos).
11. **`generateObject` con openrouter/ollama**: el provider `openai-compatible` necesita `supportsStructuredOutputs: true` (ya puesto en `lib/ai/provider.ts`); sin él no se envía el `json_schema` y los modelos flojos devuelven JSON inválido. Además el modelo elegido debe soportar *structured outputs* (p. ej. `nvidia/nemotron-3-super-120b-a12b:free` ✓; `google/gemma-4-31b-it:free` ✗).

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
# self-hosted: docker compose up -d --build  (guía en deploy/README.md §B)
```

Credenciales de dev en `.env` (ver `.env.example`). Login en `/login`.

## Estructura

- `src/app/[locale]/(public)/` — galería pública + login
- `src/app/[locale]/dashboard/{pedidos,gastos,materiales,patrones}/` — cada sección: `page.tsx` (listado), `nuevo/page.tsx` (alta), `*-form.tsx` (client, `useActionState`), `actions.ts` (server action con guard de sesión + parser de `lib/forms.ts`)
- `src/app/[locale]/dashboard/{perfil,usuarios,ajustes}/` — cuenta y administración (usuarios y ajustes con guard de rol admin en página **y** action)
- `src/lib/` — `prisma` (singleton + helpers de errores P2002/P2003), `auth` (+ `isAdmin`), `settings` (ajustes BD→env), `forms` (parsers FormData→datos), `files` (uploads), `money`, `balance` (quién debe a quién), `pricing` (precio sugerido), `validations`, `theme`, `ai/` (provider multi-LLM + contrato del patrón estandarizado)
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
- ✅ **Subida de patrón >1 MB**: el formulario sube fichero/portada a `/api/uploads`
  al elegirlos y la action recibe solo pathnames (trampa #10); `bodySizeLimit`
  a 4 MB para las fotos que sí viajan por action (materiales/pedidos/IA gastos).
- ✅ **Performance**: `loading.tsx` (dashboard y galería) para feedback instantáneo
  al navegar; caché inmutable de `/api/files` (privados en navegador, públicos
  también en CDN con `s-maxage`); lecturas de Blob por pathname con `get()` (una
  llamada menos por fichero). En dev, gran parte de la lentitud es compilación
  bajo demanda + filesystem lento (aviso de Next en el arranque).

### Fase B — Imágenes y color ✅

- ✅ **Color dominante automático** del material desde la foto: extracción en cliente
  con Canvas (`lib/color.ts`), corregible con cuentagotas sobre la propia imagen +
  selector de color (`materiales/material-color-field.tsx`).
- ✅ **Foto de pedido terminado** con fallback a la portada del patrón asociado
  (listado y cuadrícula de pedidos + galería pública).
- ✅ **Foto de patrón**: opcional al alta; si no se sube se deriva del origen en
  `lib/pattern-source.ts` (imagen más grande de las 3 primeras páginas del PDF
  vía `extractImages` de unpdf + `fast-png`, o la `og:image` de la web).
  Best-effort: si falla, el patrón queda sin portada.

### Fase C — Agente IA de gastos (multi-producto) ✅

- ✅ **Esquema multi-producto**: `Expense` (recibo: fecha, tienda, quién paga,
  envío, total) + `ExpenseItem[]` (`→ Material` opcional) + `ExpensePhoto[]`.
  Migración `expense_items` aplicada en Neon.
- ✅ **Captura/texto → gasto por IA**: `lib/ai/extract-expense.ts` (contrato +
  visión + mapeo a céntimos) + server action `extractExpenseAction`; el formulario
  rellena las líneas a partir del texto/imagen.
- ✅ **Recorte en cliente** antes de la IA (`lib/crop.ts` + `components/form/image-cropper.tsx`).
- ✅ **Checkbox "añadir a materiales"** por línea (`ExpenseItem → Material`, en
  transacción; categoría por defecto `OTRO`).
- ✅ **Imágenes de compra** (`ExpensePhoto`): subida a Blob (upload kind `expenses`,
  servidas privadas por `/api/files`) + opción por enlace (se descarga en servidor).
  El formulario sube por `/api/uploads` y guarda solo los pathnames. Nota: al editar
  se recrean las líneas → el enlace `ExpenseItem.materialId` se pierde (el material
  sigue en inventario); las casillas "añadir a materiales" salen desmarcadas en
  edición para no duplicar.

### Fase D — IA de patrones y extras

- ✅ **Pipeline IA de patrones**: extracción de texto en `lib/pattern-source.ts`
  (unpdf para PDF, mammoth para DOCX, fetch+`htmlToText` para web) +
  `standardizePattern()` + página de detalle `patrones/[id]` que renderiza el
  JSON estandarizado (metadatos, materiales, abreviaturas, secciones con rondas,
  montaje). Orquestación de `aiStatus`: el alta/edición con origen deja PENDING y
  programa la estandarización con `after()` de `next/server` (no bloquea el
  redirect); PROCESSING→DONE/ERROR, con botón estandarizar/reintentar en el
  detalle (`standardizePatternAction`). Requiere modelo con *structured outputs*
  (trampa #11).
- ✅ **Editor de patrones online**: `patrones/[id]/editor` edita campo a campo el
  JSON estandarizado (metadatos, materiales, abreviaturas, secciones/rondas con
  reordenación) y lo revalida contra el contrato al guardar
  (`updatePatternContent`, deja `aiStatus: DONE`). Sin versión estandarizada
  parte de un esqueleto vacío (sirve para escribir patrones a mano).
- ✅ **Patrones en batch** (`patrones/batch`): multi-fichero PDF/DOCX; cada uno se
  sube a `/api/uploads` al elegirlo (título editable derivado del nombre de
  fichero), la action crea N patrones PENDING y la portada + estandarización
  van en `after()` patrón a patrón. Etiquetas compartidas para todo el lote.
- ✅ **Calculadora de precio sugerido**: sección "materiales usados" en el form
  de pedido (persiste `OrderMaterial`; al editar se reemplazan las líneas) +
  calculadora en cliente: coste × multiplicador (default ×3) redondeado ↑ a
  0,50 €, con botón "aplicar" sobre el precio (`lib/pricing.ts`).
- ✅ **Perfil de usuario** (`/dashboard/perfil`): nombre, correo y contraseña
  (pide la actual). Refresca el JWT con `unstable_update` para no re-loguear.
  OJO: el seed ya NO machaca usuarios existentes (solo bootstrap si faltan),
  para que los cambios de perfil sobrevivan a los deploys.
- ✅ **Gestor de usuarios** (`/dashboard/usuarios`, solo admin): `User.role` =
  `ADMIN | USER` (viaja en el JWT → los cambios de rol/nombre se ven al
  re-loguear; la migración pone ADMIN a los usuarios existentes). Crear/editar/
  borrar con salvaguardas (no auto-borrarse, no quitarse el propio rol admin,
  la FK de gastos bloquea el borrado).
- ✅ **Panel de administración / ajustes** (`/dashboard/ajustes`, solo admin):
  modelo `Setting` (clave-valor) + `lib/settings.ts` (BD → env → default, una
  sola query por petición con `cache()` de React). Cubre: nombre/tagline del
  taller (landing, sidebar y `<title>`), galería pública on/off, acento por
  defecto (si no hay cookie `accent`) y proveedor/modelo/clave API de IA
  (claves enmascaradas, nunca llegan al cliente; `getModel()` ahora es async
  vía `getAiConfig()`). El idioma por defecto NO es configurable a propósito:
  el default locale de next-intl se compila en el routing y el proxy no puede
  leer la BD.
- ✅ **Balance fino "quién debe a quién"** en el dashboard: `lib/balance.ts`
  (gastos e ingresos a medias, greedy para N usuarios, redondeo saneado); los
  pedidos cobrados sin asignar no se reparten.

### Fase E — Importación de datos y robustez (pendiente)

- **Importar datos del Excel antiguo** (PRIORITARIO): script puntual e idempotente
  para poblar la BD con los gastos, pedidos y materiales históricos. Formato a
  definir con el fichero real (hojas, columnas, importes → céntimos, mapeo de
  quién paga → `User`).
- **Robustez del estandarizador de patrones** (conocido): a veces
  `standardizePattern` devuelve vacío/nada, y si un fichero contiene **varios
  patrones** solo procesa uno e ignora el resto. Pendiente montar una batería de
  pruebas con patrones reales para depurar prompt/segmentación (no urgente).
- **Selector de imagen de portada del patrón**: hoy `derivePatternCover` elige
  automáticamente (imagen más grande de las 3 primeras páginas del PDF / og:image)
  y a veces no es representativa; ofrecer elegir entre las imágenes candidatas
  extraídas del origen.
- **Rol admin sin re-login**: hoy el rol viaja en el JWT, así que la migración y
  los cambios de rol no se ven hasta cerrar y volver a iniciar sesión (por eso
  el menú Usuarios/Ajustes puede parecer "ausente"). Leer el rol de la BD en el
  layout y en los guards para que aparezca al instante.

### TODOS

- Filtros en las busquedas de pedidos (por asigancion, precio, etc)
- Poder borrar la imagen asociada a un pedido/patroin etc y que se borre en el storage
- Las ubicaciones deberian ser desplegable, no texto libre y poder añadir más desde administración
- Arreglar en los patrones cuando hay rondas que se hace lo mismo que aparece un mensaje a la derecha raro
- Permitir añadir notas entre rondas (para añadir ojos, relleno, etc)
- Paginacion
- En la vista publica que las iamgenes hagan animacion de aprecer mientras se scrollea hacia abajo

### Ya hecho

- ✅ Galería pública tipo mampostería (Pinterest) con CSS columns en `/`.
- ✅ **Despliegue self-hosted** con un solo `docker compose up -d --build`:
  `Dockerfile` multi-stage (standalone de Next solo con `DOCKER_BUILD=1`, no
  afecta a Vercel) + Postgres con volumen + servicio `migrate` de un solo uso
  (migraciones + seed) + volumen de uploads (driver de disco). Config en
  `deploy/selfhosted.env` (ejemplo en `deploy/`); guía en `deploy/README.md` §B.
