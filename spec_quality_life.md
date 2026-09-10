# Spec — Mejoras Quality of Life (QoL)

> Tracking del plan de mejoras QoL acordado. Marcar `- [x]` al completar cada
> tarea (incluye test cuando aplique). Rama: `feat/qol-improvements`.

## Contexto

Análisis de UX/calidad de vida sobre forms, listados, dashboard y feedback.
**Alcance acordado**: todo lo encontrado (no lo ya cubierto en el roadmap de
`AGENTS.md`). **Modelo de datos**: sugerencias desde BD vía combobox/datalist
(permite crear nuevos; cero migraciones salvo Settings nuevos).

## Resumen de progreso

| Bloque | Tema | Estado |
|---|---|---|
| 1 | Fundación de componentes (SuggestInput, Combobox, TagInput, fechas) | ✅ Hecho |
| 2 | Campos con opciones (store, customer, brand, fiber/weight, location…) | ✅ Hecho |
| 3 | Bugs pequeños (total reactivo, a11y, steps, viewHref…) | ✅ Hecho |
| 4 | Listados (patrones select, filtros pedidos/gastos/materiales) | ✅ Hecho |
| 5 | Dashboard operativo (entregas, estados, stock bajo) | ✅ Hecho |
| 6 | ImagePickerField unificado + borrado real del storage | ✅ Hecho |
| 7 | Feedback (toasts, confirm con contexto) + paginación | ✅ Hecho |

---

## Bloque 1 — Fundación de componentes

Todo lo demás reutiliza esto. Empezar aquí.

- [x] **`SuggestInput`** — `src/components/form/suggest-input.tsx`
  Wrapper de `<Input>` + `<datalist>` (opciones del servidor). Para campos con
  histórico ligero (store, customer, brand, aiModel, items de gasto).
- [x] **`ComboboxField`** — `src/components/form/combobox-field.tsx`
  Popover + búsqueda sobre el `radix-ui` unificado (SIN dep nueva: se descarta
  `cmdk`, cero sobre-ingeniería). Input buscable con navegación por teclado
  (↑↓ Home End Enter Esc), opción "limpiar" opcional, valor en input hidden
  (vacío = sin selección, los parsers ya lo tratan como null).
- [x] **Upgrade `TagInput`** — `src/components/form/tag-input.tsx:87-93`
  Datalist nativo sustituido por chips de sugerencia clicables, filtrados por
  lo tecleado y con tope de 8 (`MAX_TAG_SUGGESTIONS` en lib/tags.ts). Fix de
  race blur/click en sugerencias (`onMouseDown preventDefault`).
- [x] **`lib/dates.ts`** con `toDateInputValue()` / `todayInputValue()`
  Extraída la helper duplicada en `order-form.tsx` y `expense-form.tsx`.
  **Bug arreglado**: el default de fecha de gasto usaba
  `toISOString().slice(0,10)` (desfase UTC entre 00:00–02:00). Tests en
  `lib/dates.test.ts`.

## Bloque 2 — Campos con opciones

- [x] **`store` (gasto)** — `expense-form.tsx`
  `SuggestInput` con `distinct store` de Expense en las pages nuevo/editar.
- [x] **`customer` (pedido)** — `order-form.tsx`
  `SuggestInput` con `distinct customer` de Order (not null).
- [x] **`brand` (material)** — `material-form.tsx`
  `SuggestInput` con `distinct brand` de Material.
- [x] **`fiberType` / `weight` (material)** — `material-form.tsx`
  Constantes `YARN_FIBERS` / `YARN_WEIGHTS` en `lib/validations.ts` + Select.
  En edición el valor guardado fuera de la lista se ofrece como opción extra;
  parser pasa a `optId` (centinela NONE_VALUE → null) y sigue aceptando
  cualquier string (valores históricos intactos). Tests en forms.test.ts.
- [x] **`location` (material) → dropdown gestionable** — `material-form.tsx`
  Setting `locations` (JSON) gestionado en Ajustes con `LocationsEditor`
  (chips añadir/quitar). `getMaterialLocations()` en lib/settings.ts,
  `parseLocationsJson` tolerante en validations.ts (tests). Select en el form
  con valor histórico como opción extra si hace falta.
- [x] **`aiModel` (Ajustes)** — `settings-form.tsx`
  `SuggestInput` con `SUGGESTED_AI_MODELS[provider]` (map estático en
  validations.ts).
- [x] **Items de gasto (nombre)** — `expense-form.tsx`
  `SuggestInput` con nombres de `Material` existente (prop `materialNames`).
- [x] **`patternId` (pedido) y `materialId` (OrderMaterialsField)**
  `ComboboxField` buscable (label con `name · precio` en materiales).

## Bloque 3 — Bugs pequeños

- [x] **Total de gasto reactivo** — `expense-form.tsx`
  Controlado: automático (líneas + envío) salvo override manual con dirty flag
  (si el usuario escribe, no se pisa). Al editar, si el total guardado no
  coincide con el automático, el campo parte rellenado con el guardado.
- [x] **`paidById` default sensato** — `expense-form.tsx` + `gastos/nuevo/page.tsx`
  Default = `paidBy` del último gasto (query barata `findFirst`), fallback
  `users[0]`.
- [x] **a11y del link anidado** — `expense-form.tsx`
  Checkbox "añadir a materiales" y campo de URL en contenedores separados (ya
  no hay un input dentro del `<label>` del checkbox).
- [x] **`stock` step 0.1** — `material-form.tsx` (consistencia con las
  cantidades de pedido).
- [x] **`viewHref` en RowActions de patrones** — accesible en la lista y en
  `PatternCard` (la portada también enlaza al detalle).
- [x] **`ListSearch` sincronizado con searchParams** — `list-search.tsx`
  `useEffect` sobre el parámetro externo (atrás/adelante, enlaces con ?q=),
  ignorando los ecos del propio debounce.
- [x] **Warning de tolerancia silenciosa** — `lib/forms.ts` + forms
  `ParseResult.warning` con avisos de líneas ignoradas/fusionadas (pedido) y
  cantidades/precios corregidos (gasto). Las actions lo registran con
  `console.warn("[form]")` y los forms avisan en ámbar ANTES de enviar
  (`rowsInvalid` en gastos, `materialsWarning` en `order-materials-field`).

## Bloque 4 — Listados

- [x] **Patrones: select ligero** — `patrones/page.tsx`
  `findMany` con `select` de los campos pintados (+ tags); la presencia de
  versión estandarizada se deduce de `aiStatus` DONE/MULTIPLE sin arrastrar el
  JSON ni `imagePaths`.
- [x] **Patrones: búsqueda por tags** — en el OR junto a título.
- [x] **Patrones: filtro `aiStatus`** — chips vía `?ai=` (chips de
  `PATTERN_AI_STATUSES`, `components/dashboard/ai-status-filter.tsx`),
  conservando búsqueda y tag activo.
- [x] **Pedidos: filtros** (TODO de AGENTS.md) — chips de estado, filtro por
  asignado y orden (recientes/entrega/precio ↑↓) en
  `components/dashboard/order-filters.tsx`; **resaltado de vencidos** al ordenar
  por entrega (`isOrderOverdue` en `lib/orders.ts` + tests, fecha en ámbar en
  la tabla y en las cards).
- [x] **Gastos: filtros** — toggle recibido/pendiente y filtro por `paidBy`
  (`components/dashboard/expense-filters.tsx`); `_sum totalCents` del resultado
  filtrado junto al total del mes en la cabecera.
- [x] **Gastos: toggle "recibido" inline** en la fila — `received-toggle.tsx`
  + server action `toggleExpenseReceived` (sin pasar por el form de edición).
- [x] **Materiales: búsqueda por tags** — el OR de la búsqueda mira también
  `tags.some.name` (además del filtro `?tag=`).

## Bloque 5 — Dashboard operativo

- [x] **Entregas próximas/vencidas**: pedidos con `dueDate` ≤ 7 días o pasado
  y estado ≠ COBRADO; vencidos en ámbar (`isOrderOverdue`) y deep-link al
  listado ordenado por entrega (`?sort=due`).
- [x] **Counts por estado**: enlaces `?status=…` por cada estado con su count.
- [x] **Stock bajo**: materiales con `stock <= lowStockThreshold` (Setting
  `lowStockThreshold`, default 1, 0 = off) con deep-link a materiales.
  Lo financiero + balance intactos (`lib/balance.ts` solo recibió el filtro
  `participates` del flag de usuarios).

## Bloque 6 — ImagePickerField unificado (+ storage)

- [x] **`ImageUploadField`** — `src/components/form/image-upload-field.tsx`
  Componente único (elegir → sube a `/api/uploads` → miniatura con X, modo
  single) usado en pedido (foto) y material (foto, dentro del
  `material-color-field`). El patrón conserva su flujo propio (FileField +
  PhotoChip, ya con preview y borrado) completado con lo que faltaba:
  **portada existente borrable** (chip con X que envía "" y la action la
  limpia) y **descarte inmediato de huérfanos** (`discardUploadAction` al
  quitar una subida de esta sesión antes de guardar, también en las imágenes
  de origen y en sustituciones de fichero/portada). Gastos reutiliza su flujo
  existente (el borrado server-side ya comparaba fotos).
- [x] **Borrado real del storage** (TODO de AGENTS.md):
  - pedidos: foto llega como pathname; al cambiar/quitar la portada la action
    borra registro y fichero (`updateOrder`/`deleteOrder`).
  - materiales: ídem (`photoChanged` → `deleteUpload` del anterior; `delete`
    limpia la foto).
  - gastos: `deleteUpload` de las fotos eliminadas al actualizar/borrar.
  - patrones: `updatePattern` compara paths enviados vs guardados ("" y "[]"
    significan "lo quitaron") y limpia con `deleteUploadIfUnreferenced`
    (compartidos con hermanos multi-patrón protegidos); el form además
    descarta los huérfanos al vuelo con `discardUploadAction`.

## Bloque 7 — Feedback y paginación

- [x] **Toasts con sonner** — éxito/error en el borrado de `RowActions`
  (`DeleteConfirm`, con nombre de entidad) y feedback del toggle de recibido
  pendiente de verlo en error (la acción devuelve `{ error }`).
- [x] **Confirmación de borrado con contexto** — `row-actions.tsx`: todas las
  secciones pasan `entityName` → «¿Borrar "X"?» + toast «Se ha borrado "X"».
- [x] **Paginación simple "load more" por recuento** — pedidos y gastos:
  `?n=` acumulativo (default 30, tope 500), `take N+1` para saber si hay más
  sin contar la colección entera; `components/dashboard/load-more.tsx` es un
  enlace server-render que conserva búsqueda y filtros (sin JS).

---

## Convenciones (recordatorio AGENTS.md)

- Toda cadena nueva de UI → `messages/es.json` **y** `messages/en.json` a la vez.
- Parsers nuevos/alterados → test unitario al lado (`*.test.ts`).
- Server actions: guard `await auth()`, devolver `{ error }`, `revalidatePath("/", "layout")`.
- Navegación i18n SIEMPRE desde `@/i18n/navigation` (excepción conocida del login).
- Selects Radix opcionales: centinela `NONE_VALUE` de `lib/forms.ts`.
- Dinero en céntimos (`Int`), helpers de `lib/money.ts`.
- No enums Prisma; constantes zod en `lib/validations.ts` (trampa #2).

## Verificación

- `npm run test` (vitest), `npm run typecheck`, `npx eslint src` — al cierre de
  cada bloque y antes de acabar.
- `npm run build` antes de terminar.
- Verificación visual Playwright (scratchpad de sesión): escritorio 1280×800 y
  móvil 390×844, revisando forms afectados, listados y dashboard.

## Decisiones tomadas

1. Alcance: todo lo encontrado en el análisis (ver conversación) salvo lo ya
   en roadmap AGENTS.md, que se absorbe aquí (filtros pedidos, locations,
   borrar imágenes del storage, paginación, notas entre rondas NO — queda en
   AGENTS.md).
2. Modelo: sugerencias desde BD (distinct) + crear nuevo; `location` gestionada
   desde Ajustes vía Setting JSON (sin migración).
3. `fiberType`/`weight`: constantes canónicas + compatibilidad con valores
   históricos (se conservan como opción en edición).
