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
| 3 | Bugs pequeños (total reactivo, a11y, steps, viewHref…) | ☐ Pendiente |
| 4 | Listados (patrones select, filtros pedidos/gastos/materiales) | ☐ Pendiente |
| 5 | Dashboard operativo (entregas, estados, stock bajo) | ☐ Pendiente |
| 6 | ImagePickerField unificado + borrado real del storage | ☐ Pendiente |
| 7 | Feedback (toasts, confirm con contexto) + paginación | ☐ Pendiente |

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

- [ ] **Total de gasto reactivo** — `expense-form.tsx:425-443`
  Controlado con cálculo automático (líneas + envío) + override manual con
  dirty flag (si el usuario escribe, no se pisa).
- [ ] **`paidById` default sensato** — `expense-form.tsx:317-331`
  Default = `paidBy` del último gasto (query barata), fallback `users[0]`.
- [ ] **a11y del link anidado** — `expense-form.tsx:385-401`
  Sacar el input de URL del `<label>` del checkbox "añadir a materiales".
- [ ] **`stock` step 0.1** — `material-form.tsx:99-109` (consistencia con
  cantidades de pedido, hoy 0.5 vs 0.1).
- [ ] **`viewHref` en RowActions de patrones** — `patrones/page.tsx:161-164`
  y `:258-261` (hoy sin acceso rápido al detalle, a diferencia del resto).
- [ ] **`ListSearch` sincronizado con searchParams** — `list-search.tsx:16-43`
  Estado interno desincronizado al navegar atrás/adelante (se inicializa una
  vez). `useEffect` sobre el param externo.
- [ ] **Warning de tolerancia silenciosa** — `lib/forms.ts:86,92-105,145-150`
  Los parsers descartan líneas / imponen defaults (`.catch(1)`, `.catch(0)`,
  líneas sin material) sin avisar. Añadir `warning` opcional al resultado del
  parser y pintarlo en los forms (texto ámbar).

## Bloque 4 — Listados

- [ ] **Patrones: select ligero** — `patrones/page.tsx:73-77`
  `findMany` sin `select` arrastra `standardizedContent` (JSON enorme) e
  `imagePaths` de todos los patrones para pintar tarjetas. Añadir `select`
  con solo los campos pintados (+ `_count` de orders si se usa).
- [ ] **Patrones: búsqueda por tags** — añadir
  `tags: { some: { name: { contains: normalizeSearch(q) } } }` al OR.
- [ ] **Patrones: filtro `aiStatus`** — chips (PENDING/PROCESSING/ERROR
  principalmente) vía searchParam, patrón `TagFilter`.
- [ ] **Pedidos: filtros** (TODO de AGENTS.md)
  Chips de estado (`ORDER_STATUSES`), filtro por asignado (select de users),
  orden alternativo por `dueDate` con resaltado de vencidos. Ver
  `pedidos/page.tsx:54,76-84`.
- [ ] **Gastos: filtros**
  Toggle recibido/pendiente, filtro por `paidBy`. `_sum totalCents` del
  resultado filtrado junto al `findMany` (`gastos/page.tsx:49-56`).
- [ ] **Gastos: toggle "recibido" inline** en la fila (server action pequeña,
  sin pasar por el form de edición).
- [ ] **Materiales: búsqueda por tags** — `materiales/page.tsx:66-75`
  (hoy solo name/brand/location/fiberType; el filtro por tag existe aparte,
  pero la búsqueda de texto no mira tags).

## Bloque 5 — Dashboard operativo

- [ ] **Entregas próximas/vencidas**: pedidos con `dueDate` ≤ 7 días o pasado
  y estado ≠ COBRADO; lista compacta con deep-link al listado filtrado.
- [ ] **Counts por estado**: chips `SIN_EMPEZAR/EMPEZADO/TERMINADO/COBRADO`
  enlazados a pedidos filtrado por ese estado (necesita el filtro del Bloque 4).
- [ ] **Stock bajo**: materiales con `stock <= lowStockThreshold` (Setting
  `lowStockThreshold`, default 1) con deep-link. Se mantiene lo financiero +
  balance actual (`lib/balance.ts` sin tocar).

## Bloque 6 — ImagePickerField unificado (+ storage)

- [ ] **`ImageUploadField`** — `src/components/form/image-upload-field.tsx`
  Componente único: elegir → preview local → sube a `/api/uploads` →
  miniatura con X. Modo single y multi. Aplicar a:
  - pedido (foto, hoy `<input file>` crudo sin preview previa al guardado,
    `order-form.tsx:219-233`)
  - material (foto, `material-form.tsx:180-184`)
  - patrón (portada + imágenes, `pattern-form.tsx:158-228`; hace borrable la
    portada existente)
  - gastos reutiliza su flujo existente si encaja, si no migrar también.
- [ ] **Borrado real del storage** (TODO de AGENTS.md): las actions comparan
  paths antiguos vs nuevos y llaman `deleteUpload()` de los eliminados
  (pedidos/materiales/patrones). Portada de patrón removible sin huérfanos.

## Bloque 7 — Feedback y paginación

- [ ] **Toasts con sonner** (ya instalado y montado en `[locale]/layout.tsx:71`,
  solo se usa en convertidor): éxito/error en `DeleteButton` (`row-actions.tsx`)
  y en guards de server actions donde aporte.
- [ ] **Confirmación de borrado con contexto** — `row-actions.tsx`: pasar
  nombre/entidad al AlertDialog → «¿Borrar "X"?» en vez de genérico.
- [ ] **Paginación simple "load more" por cursor** en pedidos y gastos
  (base para el Excel histórico; hoy `findMany` sin `take` en todo el repo).

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
