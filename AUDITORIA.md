# Auditoría de la plataforma — crochety

**Fecha:** 2026-07-06
**Alcance:** código completo — rutas y auth, API, capa de datos (Prisma/SQLite), Docker/despliegue, UI/componentes, i18n y tests.
**Stack auditado:** Next.js 16.2.10 (App Router, `proxy.ts`), React 19, Prisma 7 + better-sqlite3, next-auth v5 beta, next-intl 4, Tailwind 4/shadcn, Vitest, Docker multi-stage.

**Veredicto general:** la base es sólida — las convenciones de Next 16 se siguen correctamente (verificado contra los docs de `node_modules/next/dist/docs/`), el dinero se modela bien, la gestión de ficheros tiene buenas defensas y los tests existentes son de calidad. Sin embargo, hay **3 problemas de seguridad reales** y **2 bugs que romperán el primer despliegue en un servidor Linux**, además de mejoras menores. Todos los hallazgos están verificados contra el código, no son suposiciones.

Estado funcional: dashboard home, galería pública y login funcionan; las 4 secciones CRUD (pedidos, gastos, materiales, patrones) son stubs intencionales de fase 1; la integración de IA (`src/lib/ai/`) es scaffolding de fase 2 sin cablear a nada.

---

## 🔴 Seguridad — crítico

### 1. Bypass de autorización al servir patrones privados

**Dónde:** `src/app/api/files/[...path]/route.ts:33`

El gate de sesión compara el primer segmento **crudo** de la URL:

```ts
if (segments[0] === "patterns") { /* exige sesión */ }
```

…pero el fichero que realmente se sirve es el path **canonicalizado** por `resolveUploadPath` (`src/lib/files.ts:79-85`). Ambos pueden divergir:

- `GET /api/files/orders/%2e%2e/patterns/<uuid>.pdf` → `segments[0]` es `"orders"` (no se exige sesión), pero `path.resolve` lo normaliza a `<root>/patterns/<uuid>.pdf`, que **no** escapa de la raíz, así que se sirve el PDF privado sin autenticación.
- En dev sobre Windows/macOS (FS case-insensitive), `GET /api/files/Patterns/<uuid>.pdf` tampoco pasa el check pero abre el fichero.

*Mitigante:* el atacante necesita conocer el nombre UUID del fichero, que solo ven usuarios autenticados. Aun así es un fallo de lógica de autorización genuino.

**Fix propuesto:** derivar el tipo del path canónico, no de la URL:

```ts
const kind = path.relative(UPLOAD_ROOT, absPath).split(path.sep)[0];
if (kind === "patterns") { /* exige sesión */ }
```

### 2. `Cache-Control: public, immutable` en ficheros privados

**Dónde:** `src/app/api/files/[...path]/route.ts:45`

Los PDF/DOCX de patrones (protegidos por sesión) se sirven con `public, max-age=31536000, immutable`. Cualquier caché compartida — CDN, reverse proxy, caché corporativa — puede almacenar la respuesta y servirla después a usuarios **no autenticados**, anulando el gate de sesión.

**Fix propuesto:** para `patterns`, `Cache-Control: private, no-store`; mantener `public, immutable` solo para las imágenes públicas.

### 3. Open redirect tras el login

**Dónde:** `src/app/[locale]/(public)/login/login-form.tsx:42`

```ts
router.push(callbackUrl?.startsWith("/") ? callbackUrl : fallback);
```

`callbackUrl` es un query param controlable por el atacante, y `"//evil.com".startsWith("/")` es `true`: una URL protocol-relative navega fuera del origen. Un enlace de phishing `/login?callbackUrl=//evil.com` redirige a la víctima a un sitio externo justo después de autenticarse.

El test existente (`login-form.test.tsx:73`, "ignora callbackUrl externos") solo cubre `https://…` y da falsa confianza — no cubre el vector `//`.

**Fix propuesto:**

```ts
const safe = !!callbackUrl && callbackUrl.startsWith("/")
  && !callbackUrl.startsWith("//") && !callbackUrl.startsWith("/\\");
router.push(safe ? callbackUrl : fallback);
```

…y añadir el caso `//evil.com` al test.

---

## 🟠 Importante

### 4. Docker: usuario no-root + bind mounts → fallo de escritura en Linux

**Dónde:** `Dockerfile:42,58` + `docker-compose.yml:12-14`

El Dockerfile crea el usuario de sistema `nextjs` y hace `chown` de `/app/data` y `/app/uploads` dentro de la imagen; pero el compose monta `./data` y `./uploads` del host **encima** de esos directorios. Un bind mount conserva el owner del host (típicamente uid 1000 o root), enmascarando el `chown`. En un servidor Linux, `prisma migrate deploy` no podrá crear `crochety.db` y, con `set -e` en `docker/entrypoint.sh`, el contenedor muere al arrancar. Funciona hoy en Docker Desktop (Windows/macOS) solo por sus permisos laxos.

**Fix propuesto:** usar volúmenes con nombre en lugar de bind mounts; o alinear el uid con `user:` en el compose; o documentar el `chown` necesario de los directorios del host.

### 5. El seed de dev no normaliza el email → login que falla en silencio

**Dónde:** `prisma/seed.ts:34-36` vs `src/lib/auth.ts`

El seed guarda `user.email` tal cual llega del `.env`, pero el login busca con `.trim().toLowerCase()`. Cualquier `USER*_EMAIL` con mayúsculas queda guardado mixed-case y **nunca podrá hacer login** en dev, sin ningún error que lo delate. El seed de Docker (`docker/seed.cjs:36`) sí hace `toLowerCase()`, así que dev y prod ya divergen.

**Fix propuesto:** `email.trim().toLowerCase()` en `prisma/seed.ts` (tanto en `where` como en `create`).

### 6. Dos implementaciones de seed divergentes

**Dónde:** `prisma/seed.ts` (Prisma/TS) vs `docker/seed.cjs` (SQL crudo con better-sqlite3)

Ya han divergido (ver punto 5). Cualquier cambio futuro en el modelo de usuario hay que hacerlo dos veces y es fácil que se olvide una.

**Fix propuesto:** converger en una sola implementación (p. ej. ejecutar el seed TS también en el contenedor) o, como mínimo, un test de paridad entre ambas.

### 7. `secureCookie` inferido del protocolo interno de la request

**Dónde:** `src/proxy.ts:29`

```ts
secureCookie: nextUrl.protocol === "https:",
```

`getToken` elige el nombre de cookie según este flag (`authjs.session-token` vs `__Secure-authjs.session-token`). Detrás de un reverse proxy con TLS terminado (el despliegue Docker previsto), Next ve `http` interno → el proxy busca la cookie sin prefijo mientras el navegador tiene la `__Secure-` → `getToken` devuelve `null` → **bucle de redirect a /login para usuarios autenticados**. Footgun latente de producción; hoy no se manifiesta porque el compose sirve http plano.

**Fix propuesto:** derivar el flag de `x-forwarded-proto`/`AUTH_URL`, o dejar que Auth.js resuelva el nombre de cookie por sí mismo. Verificar end-to-end detrás del proxy real antes del despliegue.

### 8. La validación de subida confía en el MIME declarado por el cliente

**Dónde:** `src/lib/files.ts:48-49,65`

Tipo y extensión se deciden únicamente por `file.type`, que es controlado por el atacante. La respuesta de descarga tampoco envía `X-Content-Type-Options: nosniff` ni `Content-Disposition`. El riesgo real es bajo (SVG no está en la whitelist, así que no hay stored-XSS obvio), pero la validación es más débil de lo que aparenta.

**Fix propuesto:** validar magic bytes del contenido, añadir `X-Content-Type-Options: nosniff` a las respuestas y `Content-Disposition: attachment` para los documentos.

### 9. Cero tests en el núcleo de seguridad

Los tests que existen son buenos (ver "Lo que está bien"), pero el problema es la cobertura: no hay **ningún** test para:

- `src/proxy.ts` — protección de rutas, redirects login/dashboard, generación de `callbackUrl`.
- `authorize()` en `src/lib/auth.ts` — normalización de email, `bcrypt.compare`, null-on-fail.
- Los handlers HTTP `src/app/api/uploads/route.ts` y `src/app/api/files/[...path]/route.ts` — 401 sin sesión, 400 con kind inválido, gate de patrones (solo están testeados los helpers de `lib/files.ts`).

**Fix propuesto:** unit tests de `authorize()` (credenciales válidas/inválidas/ausentes) y de los dos route handlers; añadir el caso `//` al test del login (punto 3).

---

## 🟡 Menor

10. **Fotos de pedidos no públicos se sirven sin auth** — `src/app/api/files/[...path]/route.ts:32-38` solo protege `patterns`; nunca se comprueba `Order.isPublic` antes de servir una foto de pedido. La protección real es la impredecibilidad del UUID. Aceptable para un portfolio, pero conviene documentar la decisión o comprobar `isPublic`.
11. **Sin `error.tsx` / `loading.tsx` / `not-found.tsx`** en todo `src/app` — el dashboard lanza 5 queries Prisma sin loading UI; un SQLite bloqueado/inaccesible muestra el error crudo de Next; un locale inválido cae al 404 por defecto sin chrome ni i18n. Añadir al menos `dashboard/loading.tsx`, un `error.tsx` y un `not-found.tsx` localizados.
12. **Sin metadata por página** — solo `src/app/[locale]/layout.tsx:23` define `title.template: "%s · Zgz Stitches"`, pero ninguna página exporta `metadata`/`generateMetadata`, así que el template nunca se rellena y todas las rutas comparten el mismo título. Añadir `generateMetadata` por página usando `getTranslations`.
13. **Sin índices en columnas FK** — SQLite no indexa foreign keys automáticamente: `Order.assignedToId`, `Order.patternId`, `OrderPhoto.orderId`, `OrderMaterial.materialId`, `Expense.paidById` van sin índice (candidatos extra: `Order.status` y `Order.isPublic` para la query de la galería). Irrelevante a escala de 2 usuarios, pero barato de arreglar con `@@index` en `prisma/schema.prisma`.
14. **`playwright` es dependencia muerta** — `package.json:56`; no hay `playwright.config.*`, ni specs, ni script que lo use. Quitarla, o montar e2e de verdad (`@playwright/test` + config + script `test:e2e`).
15. **El README sobrevende la IA** — anuncia "patrones estandarizados por IA", pero `src/lib/ai/provider.ts` y `standardize-pattern.ts` solo los importan sus propios tests; el propio código lo documenta como fase 2 (`standardize-pattern.ts:60-66`). Marcarlo como WIP en el README (el código del provider en sí está bien hecho: server-only, claves nunca al cliente, errores claros).
16. **Login: enumeración por timing y sin rate-limit** — en `src/lib/auth.ts`, un usuario inexistente retorna sin ejecutar `bcrypt.compare` (diferencia de tiempo medible) y no hay throttling/lockout en ninguna capa. Impacto bajo (2 usuarios seed, mensaje de error genérico), pero un `compare` contra un hash dummy y un rate-limit básico lo cierran.

---

## 🔵 Pulido

17. **Claves i18n muertas** — `Common.appName` y `Common.loading` (`messages/en.json:3-4`, `messages/es.json:3-4`) no se usan en ningún sitio; la marca está hardcodeada en 5 puntos (`dashboard/layout.tsx:42,82`, `mobile-nav.tsx:29`, `(public)/layout.tsx:14`, `(public)/page.tsx:25`). Usar la clave o eliminarla.
18. **Accesibilidad del nav** — `src/components/dashboard/nav.tsx:41-51`: el enlace activo solo se distingue visualmente; añadir `aria-current={active ? "page" : undefined}`.
19. **Saludo vacío** — `src/app/[locale]/dashboard/page.tsx:58`: con `name` null se renderiza "Hola,  🧶". Cosmético (los usuarios seed tienen nombre).
20. **i18n sin render estático** — no hay `generateStaticParams` ni `setRequestLocale` en ninguna ruta, así que todas las páginas localizadas son dinámicas. El dashboard lo sería igualmente (auth + BD), pero la landing y el login podrían ser estáticos.
21. **`centsToEur` devuelve float** — `src/lib/money.ts:4-6`: correcto para display, pero nunca debe usarse dentro de una suma; toda la aritmética debe quedarse en céntimos (como ya hace el resto del código).

---

## ✅ Lo que está bien

- **Convenciones Next 16 correctas** (verificadas contra `node_modules/next/dist/docs/`): `src/proxy.ts` es el rename correcto de `middleware.ts`; `params`, `searchParams` y `cookies()` se `await`-ean en todas partes; el matcher del proxy excluye correctamente `/api`, `_next` y estáticos.
- **Modelo de dinero correcto**: todo lo monetario es `Int` en céntimos (`priceCents`, `totalCents`…); `eurToCents` usa `Math.round`; `Float` solo para cantidades físicas reales (`stock`, `quantity`).
- **Gestión de ficheros con buenas defensas**: `resolveUploadPath` bloquea traversal (`../`, absolutos, prefijos hermanos) y está bien testeado; nombres UUID generados (nunca el nombre original); whitelist de MIME; límites de tamaño por tipo; documentos solo en `patterns`.
- **Arquitectura de auth sensata**: split edge-safe (`auth.config.ts` sin Prisma para el proxy) + sesión JWT; registro deshabilitado a propósito; bcryptjs coste 12; `getToken` con los defaults de cookie correctos de Auth.js v5 (verificado en `@auth/core`).
- **Prisma bien montado**: singleton con guard de hot-reload (`src/lib/prisma.ts`); cliente generado gitignorado y regenerado en `postinstall` y en el build de Docker; `onDelete` coherente (Cascade para hijos, SetNull para asignaciones, Restrict para referencias vivas).
- **Higiene de secretos y de git**: `.env` ignorado y no trackeado; `.env.example` completo; `data/`, `uploads/`, `*.tsbuildinfo` y el cliente generado, todos ignorados.
- **Docker bien diseñado** (salvo el punto 4): multi-stage limpio con etapa migrator autocontenida, usuario no-root, telemetría off; `better-sqlite3` cubierto por los `serverExternalPackages` por defecto de Next con `output: "standalone"`.
- **Theming y i18n sólidos**: next-themes + sistema de acentos SSR-safe sin hydration mismatch (cookie → `data-accent` en servidor); Tailwind 4 CSS-first correcto; paridad perfecta en/es (62 claves cada uno).
- **Los tests existentes son de calidad real**: `files.test.ts` cubre traversal y límites; `money.test.ts` cubre imprecisión de floats; `login-form.test.tsx` y `nav.test.tsx` asertan comportamiento real con i18n de verdad. El problema es la amplitud (punto 9), no la calidad.

---

## Priorización sugerida

1. **Ya:** fixes 1–3 (seguridad; cambios pequeños y localizados en 2 ficheros).
2. **Antes del primer despliegue Docker en Linux:** fixes 4–5 (y decidir sobre 6 y 7).
3. **Al construir los CRUD de fase 1:** 8–16 según toque cada área (los tests del punto 9 conviene escribirlos junto a los fixes de seguridad, no después).
