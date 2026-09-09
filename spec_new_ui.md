# Spec — Lavado de cara UI (new UI)

> Tracking del plan de rediseño de interfaz acordado tras el análisis visual
> (Playwright 1280×800 + 390×844, claro/oscuro) y el mapa de código. Marcar
> `- [x]` al completar cada tarea (con test cuando aplique).
> Rama: `feat/ui-facelift` (base: `feat/qol-improvements`).

## Contexto

La web funciona pero es visualmente plana: blanco/gris neutro, cards sin
elevación, cero animaciones, sin jerarquía tipográfica. Hallazgos clave:

1. **17 `<img>` sin fallback de error** (galería, tarjetas, detalles, previews):
   un 404 de `/api/files` muestra el tile roto con alt-text. En prod no hay
   ficheros rotos, pero cualquier fallo de Blob/borrado se vería mal.
2. **Tarjetas/filas duplicadas inline** en cada `page.tsx` (grid y lista de
   pedidos/materiales/patrones) y `STATUS_CLASSES` copiado en
   `pedidos/page.tsx:36` y `pedidos/[id]/page.tsx:14`. Extraer componentes
   compartidos ANTES de maquillar.
3. **Usabilidad**: tablas desbordan en móvil (badges cortados), badge
   "Recibido" repetido en gastos, RowActions icon-only sin tooltip, forms con
   inputs de fichero nativos y sin sticky footer, galería sin animación al
   scroll ni CTA, detalle de patrón con columna de totales sin estilo y chevron
   de rondas repetidas que no rota (falta `group` en el `<details>`).

**Decisiones de alcance** (acordadas):
- Facelift **+ refactor ligero** (extraer `OrderCard`/`MaterialCard`/
  `PatternCard` antes de maquillar).
- Identidad **cozy pro sutil**: mantener Nunito y los 4 acentos; fondos
  cálidos, sombras blandas, animaciones suaves de entrada, hover acogedor.
  Sin recargar: nada de ilustraciones ni tipografía nueva.
- **`AssetImage`** con placeholder incluido (centraliza los 17 `<img>`).

**Relación con `spec_quality_life.md`**: solapan los filtros de pedidos y la
interfaz de imágenes (su bloque 4 y 6). Lo visual se implementa en esta rama;
los ítems puramente funcionales (toasts, paginación) siguen en la spec QoL.
Al completar un solape aquí, marcarlo allí.

**Reglas inquebrantables**: money en céntimos (`lib/money.ts`), sin enums de
Prisma, textos SIEMPRE en `messages/es.json` y `en.json`, navegación via
`@/i18n/navigation`, cero deps nuevas (usar lucide + CSS; nada de librerías de
animación).

## Resumen de progreso

| Bloque | Tema | Estado |
|---|---|---|
| 1 | Fundación visual (tokens cozy, sombras, reveal) | ✅ Hecho |
| 2 | Infra de UI (AssetImage, status, cards, FileField) | ✅ Hecho |
| 3 | Vitrina pública (hero, masonry, login) | ✅ Hecho |
| 4 | Dashboard (KPIs, balance Splitwise) | ✅ Hecho |
| 5 | Listados (pedidos+filtros, gastos, materiales, patrones) | ✅ Hecho |
| 6 | Detalles y forms (tooltips, sticky, patrón, dark) | ✅ Hecho |
| 7 | QA final (capturas, contraste, i18n espejado) | ✅ Hecho |

---

## Bloque 1 — Fundación visual

Todo lo demás reutiliza esto. Empezar aquí.

- [x] **Tokens cálidos** — `src/app/globals.css`
  Claro: `--background` crema/lino (~oklch(0.98 0.006 80)), muted/border con
  matiz cálido; oscuro: fondo ~oklch(0.17 0.005 80) en vez de gris neutro.
  Los 4 acentos y el resto de vars NO cambian.
- [x] **Sombras cozy** — `globals.css`
  `--shadow-cozy` (blanda, 2 niveles) + utilidad `.cozy-card` (hover: lift 2px
  + shadow, transition ~200 ms) para tarjetas de listados.
- [x] **Animaciones de entrada** — `globals.css` + `src/components/reveal.tsx`
  Keyframes `fade-up`/`fade-in` + clases `.reveal`/`.reveal-visible`
  (componente client `<Reveal>` con IntersectionObserver y delay opcional para
  stagger). El estado inicial oculto solo aplica con `html.js` (script inline
  añadido al layout) para no ocultar contenido sin JS; respeta
  `prefers-reduced-motion`. Sin deps nuevas.
- [x] **Tipografía/dinero** — `globals.css`: utilidad compartida `.h1-display`
  (Nunito 800, tracking-tight) aplicada a los 27 h1 de la app; dinero siempre
  `tabular-nums` en tablas y KPIs (balance del dashboard incluido).
- [x] **Swatches del `AccentPicker`** sincronizados con los oklch reales de
  `globals.css` (hoy estaban hardcodeados distintos).

## Bloque 2 — Infra de UI compartida

- [x] **`AssetImage`** — `src/components/asset-image.tsx` (client)
  Wrapper de `<img>` con `onError` → placeholder bonito. Variantes: icono
  lucide sobre `bg-accent`, swatch del color del material (props), o vacío.
  Detecta también imágenes rotas llegadas antes de hidratar
  (`naturalWidth === 0` post-mount). Props: `src/alt/className/ratio`.
  Aplicados de momento (con `assetUrl` de `lib/assets.ts`): galería pública y
  pedidos (lista, grid y detalle).
- [x] Resto de reemplazos de `<img>` por `AssetImage` — aplicados en detalle de
  patrones (`patrones/[id]/page.tsx` + `cover-picker.tsx` + `manual-standardize.tsx`
  vía `PhotoChip`), gasto `gastos/[id]/page.tsx`, previews de forms
  (`expense-form.tsx`, `order-form.tsx`, `pattern-form.tsx`,
  `convertidor-form.tsx`) y `materiales/[id]/page.tsx` (el cuentagotas de
  `material-color-field` usa canvas, no `<img>`). Ya aplicados antes: galería,
  pedidos (lista, grid, detalle), materiales/patrones (grid + lista), previews
  con `PhotoChip` (chips con borrar compartido por 4 formularios). Lazy loading
  igual que hoy (se mantiene `<img>`, NO next/image).
- [x] **Fix test flaky** — `settings.test.ts` con timeout 15 s (la cadena de
  imports del adapter de Prisma expiraba a 5 s con la máquina cargada).
- [x] **`lib/status.ts`** + `lib/status.test.ts`
  Metadatos únicos de estado (claves i18n + clases badge con puntito de
  color) para estados de pedido y `AiStatus` de patrones. Borrada la
  duplicación de `STATUS_CLASSES`; nuevo `components/dashboard/status-badge.tsx`
  (server, con fallback `Common.unknownStatus` para String libres de BD) y
  `AiStatusBadge` delega en él.
- [x] **`components/dashboard/cards.tsx`** — `MaterialCard`, `PatternCard`
  (+ helpers `PatternSourceLinks`, `ExportLinks`, `MaterialLinkBadge`)
  Consumidas por las vistas grid (y helpers por la lista) de cada `page.tsx`
  (hoy JSX inline). Estructura: portada a proporción fija (3/2 patrones,
  4/3 materiales) con badge de estado arriba-izquierda y acciones en píldora
  arriba-derecha (fuera del enlace de portada), título enlazado a la ficha
  (line-clamp), `.cozy-card` con hover-lift + zoom de portada, pies
  consistentes. `OrderCard` añadido (pedidos: grid y bloque móvil del
  listado); la fila de gasto no se extrae: gastos sigue como libro contable
  con tarjetas inline para móvil (Bloque 5).
- [x] **`EmptyState` con CTA** — `src/components/empty-state.tsx`
  `action?: {href,label}` (y `icon: ReactNode` para admitir el 🧶). Usado en la
  galería pública (sin CTA para anónimos) y con CTA en el vacío de pedidos.
- [x] **`FileField`** — `src/components/form/file-field.tsx`
  Dropzone con drag&drop y texto i18n; sustituye los inputs nativos
  ("Choose File…") en pedido/material/patrón/gasto/convertidor (también batch y
  manual-standardize). Con `name`, el fichero viaja en el FormData de la action
  (pedido/material); sin `name`, la subida es en cliente y el input se resetea
  (patrones/convertidor/gasto). Reutiliza la lógica de subida ya existente de
  cada form (solo UI).

## Bloque 3 — Vitrina pública

- [x] **Header sticky** — `(public)/header.tsx` (client): sticky, borde y
  `bg-background/80 backdrop-blur` al hacer scroll; footer pulido con nota.
- [x] **Hero**: título display + tagline, blob/gradiente sutil del acento
  detrás, CTA ancla a la mampostería (`#galeria`); hero vacío con el 🧶
  animado suave (`animate-bounce-slow`, `globals.css`).
- [x] **Masonry**: tiles con `AssetImage`, overlay hover con nombre (gradiente
  inferior) + zoom, aparición al scroll con `<Reveal>` y stagger por índice
  (TODO del roadmap de `AGENTS.md`).
- [x] **Login** — `(public)/login/page.tsx`: card centrada con fondo
  decorado sutil (blob del acento + patrón de punto `.stitch-pattern` en CSS,
  sin imágenes).

## Bloque 4 — Dashboard

- [x] **KPIs con identidad** — `dashboard/page.tsx`: icono + tinte por
  métrica (ganado=acento, gastado=muted, beneficio=positivo/negativo),
  cifras `tabular-nums` + font-heading.
- [x] **Balance estilo Splitwise** — `dashboard/page.tsx` + `lib/balance.ts`
  (solo render): tarjetas por persona con avatar de iniciales y color
  derivado del nombre (`lib/avatar.ts` + clase `.initials-avatar` temática),
  flechas de deuda ("Alba → Natalia  37,58 €") con `aria-label` del mensaje
  `owes`, netos en color (positivo=verde, negativo=destructive). Algoritmo
  intacto (tiene tests); helper nuevo con test (`lib/avatar.test.ts`).

## Bloque 5 — Listados

- [x] **Pedidos**: `OrderCard` en grid; lista con thumbs `AssetImage`;
  **filtros** por estado (chips de `ORDER_STATUSES`), asignado (select de
  users) y orden (recientes/entrega/precio ↑↓) vía query params junto al
  `ListSearch` (`components/dashboard/order-filters.tsx`, solape con QoL
  bloque 4). **Móvil**: tabla → lista de tarjetas (`hidden sm:table` +
  bloque `sm:hidden` con `OrderCard`).
- [x] **Gastos**: badge "Pendiente" solo cuando toque (destructive-soft;
  recibido = "—"); importes alineados a la derecha `tabular-nums`; total del
  mes en la cabecera (`spentThisMonth`); móvil: cards.
- [x] **Materiales**: toolbar compacta (búsqueda + vista + tags + colores en
  un contenedor card); card con fallback swatch del color dominante
  (ya en `MaterialCard`).
- [x] **Patrones**: `PatternCard` con cover + `AiStatusBadge` + export links
  (Ver fichero/Ver enlace/MD/EPUB) en una fila consistente; tags chips (hecho
  con las cards del Bloque 2). Toolbar compacta igual que materiales.
- [x] **Usuarios**: tabla al mismo patrón visual, con avatar de iniciales.

## Bloque 6 — Detalles y forms

- [x] **`RowActions`**: tooltips en desktop (con foco de teclado); en móvil
  `DropdownMenu` (⋯) para ganar espacio en la fila; `DeleteConfirm` compartido.
- [x] **Sticky footer de forms** (Guardar/Cancelar) con blur:
  `components/form/form-footer.tsx` aplicado en pedido/gasto/material/patrón/
  ajustes/perfil/usuarios.
- [x] **Estado de pedido como pills** (segmented, radios nativos con
  `has-checked:`) en el form; el total del gasto ya era un único campo con
  `autoTotal` como hint (resaltado con font-heading en el detalle).
- [x] **Detalle de patrón** — `patrones/[id]/page.tsx`: totales por ronda
  como badge alineado a la derecha (la columna "rara" del TODO), chevron de
  rondas repetidas rotando (`group` en el `<details>`), abreviaturas/materiales
  sticky en columna lateral (`lg:sticky top-20`, stack en móvil).
- [x] **Detalles de pedido/gasto/material**: jerarquía de títulos
  (`h1-display` + badge, card "Detalles"), fotos en grid consistente
  (`AssetImage`, rounded-xl + border), total del gasto destacado.
- [x] **Dark mode QA**: revisión completa de contraste (AA) con los nuevos
  tokens cálidos. Auditoría programática con Playwright
  (`.opencode/contrast-audit.mjs`, conversión oklch→sRGB + composición de
  alfas/opacidades por cadena de ancestros, incluye placeholders): 0 fallos en
  las 10 páginas clave en claro y oscuro (verificada la fiabilidad con sondas
  de contraste deliberado). Revisión visual extra en dark de usuarios (nueva
  columna Balance) y dashboard; arreglada la tabla de usuarios en móvil
  (Correo/Alta ocultas <md/<sm para que quepan Rol, Balance y acciones).

## Bloque 7 — QA final

- [x] **i18n**: todo texto nuevo en `messages/es.json` **y** `en.json`
  (espejo verificado con diff de claves: 0 diferencias; fix de
  `Forms.rowActions` que había quedado con clave literal).
- [x] **Tests**: `lib/avatar.test.ts` (helper nuevo del balance, 6 tests),
  `lib/search.test.ts` ampliado con `hexToHsl`/`sortByColorHue` (orden del
  arcoíris del filtro de color). `npm run test` verde (226 tests, 28 ficheros).
- [x] **Verificación visual Playwright**: 72+ capturas (desktop 1280×800 y
  móvil 390×844, claro/oscuro) en `.opencode/shots/` — galería, login,
  dashboard, pedidos (lista/filtro/nuevo/detalle), gastos (lista/detalle/
  nuevo), materiales (lista/nuevo), patrones (lista/detalle/nuevo), usuarios,
  ajustes, perfil. Contrast AA en dark OK (badges con puntito, netos
  verde/destructive, avatares temáticos); corregido blob del hero con corte
  visible en dark (máscara radial) y pills de estado que rompían en
  pantallas estrechas.
- [x] `npm run typecheck` + `npx eslint src` limpios + `npm run build` OK.

### Bugs encontrados por el QA (arreglados)

- **`repeatRounds` FORMATTING_ERROR**: el mensaje es ICU plural
  (`{count, plural, …}`) y se formateaba con `.replace("{count}")` — ahora
  `repeatRoundsLabel(count)` vía `t("repeatRounds", { count })`.
- **Keys duplicadas "Lana negra"** en el datalist de items de gasto: 3
  materiales comparten nombre; `materialNames` deduplicado con `Set`.
- **Pills de estado rotas en desktop estrecho**: el contenedor de 1/3 columna
  apilaba las 4 pills (círculo gigante); ahora fila completa bajo
  cantidad/precio.

## Fuera de alcance

- Paginación completa y notas entre rondas (roadmap `AGENTS.md`; lo segundo
  requiere tocar el contrato JSON de la IA).
- `next/image` (Blob/paths no lo requieren; se mantiene `<img>` lazy).
- Migraciones/seed/datos: nada. Money en céntimos intacto.
- Librerías nuevas de animación/iconos (usar lo instalado: tw-animate-css,
  lucide, CSS propio).
