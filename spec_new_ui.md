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
| 2 | Infra de UI (AssetImage, status, cards, FileField) | ☐ Pendiente |
| 3 | Vitrina pública (hero, masonry, login) | ☐ Pendiente |
| 4 | Dashboard (KPIs, balance Splitwise) | ☐ Pendiente |
| 5 | Listados (pedidos+filtros, gastos, materiales, patrones) | ☐ Pendiente |
| 6 | Detalles y forms (tooltips, sticky, patrón, dark) | ☐ Pendiente |
| 7 | QA final (capturas, contraste, i18n espejado) | ☐ Pendiente |

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
- [ ] **Tipografía/dinero**: h1 display (Nunito 800, tracking-tight); dinero
  siempre `tabular-nums` en tablas y KPIs.
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
- [ ] Resto de reemplazos de `<img>` por `AssetImage` — van junto a la
  extracción de cards: materiales (`materiales/page.tsx:161,234` y
  `materiales/[id]/page.tsx:96`); patrones (`patrones/page.tsx:139,208` y
  `patrones/[id]/page.tsx:96` + `cover-picker.tsx`,
  `manual-standardize.tsx:87`); gasto `gastos/[id]/page.tsx:107`; previews de
  forms (`expense-form.tsx:463`, `order-form.tsx:226`,
  `pattern-form.tsx:164,216`, `convertidor-form.tsx:717`) y
  `material-color-field.tsx:150`. Lazy loading igual que hoy (se mantiene
  `<img>`, NO next/image).
- [x] **`lib/status.ts`** + `lib/status.test.ts`
  Metadatos únicos de estado (claves i18n + clases badge con puntito de
  color) para estados de pedido y `AiStatus` de patrones. Borrada la
  duplicación de `STATUS_CLASSES`; nuevo `components/dashboard/status-badge.tsx`
  (server, con fallback `Common.unknownStatus` para String libres de BD) y
  `AiStatusBadge` delega en él.
- [ ] **`components/dashboard/cards.tsx`** — `OrderCard`, `MaterialCard`,
  `PatternCard` (+ fila de gasto si aplica)
  Consumidas por las vistas grid y lista de cada `page.tsx` (hoy JSX inline).
  Con `.cozy-card`, `AssetImage` y badges de `lib/status.ts`.
- [ ] **`EmptyState` con CTA** — `src/components/empty-state.tsx`
  Añadir `action?: {href,label}`; usar en galería pública cuando no haya
  fotos (hoy tiene bloque inline propio).
- [ ] **`FileField`** — `src/components/form/file-field.tsx`
  Dropzone con drag&drop, preview y botón de borrar; sustituye los inputs
  nativos ("Choose File…") en pedido/material/patrón/gasto/convertidor.
  Reutiliza la lógica de subida ya existente de cada form (solo UI).

## Bloque 3 — Vitrina pública

- [ ] **Header sticky** — `(public)/layout.tsx`: backdrop-blur al hacer
  scroll; footer pulido.
- [ ] **Hero**: título display + tagline, blob/gradiente sutil del acento
  detrás, CTA ancla a la mampostería; hero vacío con el 🧶 animado suave
  (`(public)/page.tsx`).
- [ ] **Masonry**: tiles con `AssetImage`, overlay hover con nombre + zoom
  (ya hay `scale-105`), aparición al scroll con `useReveal` y stagger por
  columna (TODO del roadmap de `AGENTS.md`).
- [ ] **Login** — `(public)/login/page.tsx`: card centrada con fondo
  decorado sutil (patrón de punto en CSS, sin imágenes).

## Bloque 4 — Dashboard

- [ ] **KPIs con identidad** — `dashboard/page.tsx`: icono + tinte por
  métrica (ganado=acento, gastado=muted, beneficio=positivo), cifras
  `tabular-nums`.
- [ ] **Balance estilo Splitwise** — `dashboard/page.tsx` + `lib/balance.ts`
  (solo render): tarjetas por persona con avatar de iniciales y color
  derivado del nombre, flechas de deuda ("Alba → Natalia 37,58 €"), netos
  en color. Sin cambiar el algoritmo (tiene tests).

## Bloque 5 — Listados

- [ ] **Pedidos**: `OrderCard` en grid; lista con thumbs `AssetImage`;
  **filtros** por estado (chips: Sin empezar/Terminado/Cobrado), asignado y
  orden por precio/fecha vía query params junto al `ListSearch` (solape con
  QoL bloque 4). **Móvil**: tabla → lista de tarjetas (`hidden sm:table` +
  bloque `sm:hidden`).
- [ ] **Gastos**: badge "Pendiente" solo cuando toque (destructive-soft);
  importes alineados a la derecha `tabular-nums`; total del mes en la
  cabecera; móvil: cards.
- [ ] **Materiales**: toolbar compacta (búsqueda + tags + colores); card con
  fallback swatch del color dominante (quedará natural en lanas).
- [ ] **Patrones**: `PatternCard` con cover + `AiStatusBadge` + export links
  (Ver fichero/Ver enlace/MD/EPUB) en una fila consistente; tags chips.
- [ ] **Usuarios**: tabla al mismo patrón visual.

## Bloque 6 — Detalles y forms

- [ ] **`RowActions`**: tooltips en desktop; en móvil `DropdownMenu` (⋯) para
  ganar espacio en la fila.
- [ ] **Sticky footer de forms** (Guardar/Cancelar) con blur en
  pedido/gasto/material/patrón/ajustes/perfil/usuarios.
- [ ] **Estado de pedido como pills** (segmented) en el form; total
  automático del gasto consolidado en un único campo claro.
- [ ] **Detalle de patrón** — `patrones/[id]/page.tsx`: totales por ronda
  como badge alineado a la derecha (la columna "rara" del TODO), chevron de
  rondas repetidas rotando (añadir `group` al `<details>`), abreviaturas
  sticky en pantallas anchas.
- [ ] **Detalles de pedido/gasto/material**: jerarquía de títulos, fotos en
  grid consistente.
- [ ] **Dark mode QA**: revisión completa de contraste (AA) con los nuevos
  tokens cálidos.

## Bloque 7 — QA final

- [ ] **i18n**: todo texto nuevo en `messages/es.json` **y** `en.json`
  (espejo completo; revisar con diff de claves).
- [ ] **Tests**: `lib/status.test.ts`, helpers puros nuevos (filtros de
  pedidos si añaden lógica). `npm run test` verde.
- [ ] **Verificación visual Playwright**: re-capturar TODAS las páginas en
  claro/oscuro/móvil (desktop 1280×800, móvil 390×844) y comparar contra las
  de antes del facelift; revisar contraste AA en dark.
- [ ] `npm run typecheck` + `npx eslint src` limpios.

## Fuera de alcance

- Paginación completa y notas entre rondas (roadmap `AGENTS.md`; lo segundo
  requiere tocar el contrato JSON de la IA).
- `next/image` (Blob/paths no lo requieren; se mantiene `<img>` lazy).
- Migraciones/seed/datos: nada. Money en céntimos intacto.
- Librerías nuevas de animación/iconos (usar lo instalado: tw-animate-css,
  lucide, CSS propio).
