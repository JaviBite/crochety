# Spec — Pattern Parser (convertidor de patrones + exportación MD/EPUB)

> Estado general: 🚧 backend completo y probado; pendiente verificación visual
> del convertidor (Playwright) · Última actualización: 2026-09-04
>
> Página del dashboard que convierte **imagen / PDF / web / texto** en patrones de
> crochet **estandarizados** (JSON con secciones, rondas, stitches, abreviaturas y
> pasos custom), con exportación a **Markdown** y **EPUB**. Reutiliza el pipeline
> existente (`lib/pattern-source.ts` + `lib/ai/standardize-pattern.ts`) y añade
> soporte multi-patrón, human-in-the-loop y exportadores.

## Decisiones tomadas (con el usuario)

| Tema | Decisión |
|---|---|
| Ubicación | Sección protegida del dashboard: `/dashboard/convertidor` (no pública, consume claves LLM) |
| Persistencia | Conversión **efímera** (en memoria, sin tocar BD) + botón opcional "guardar en mis patrones" |
| Exportación | **Markdown + EPUB** (`epub-gen-memory`, genera en memoria). Individual + **recopilatorio** (un EPUB con un capítulo por patrón + MD concatenado) |
| Pasos custom | Instrucciones intercaladas sin conteo ("Ronda X: inserta los ojos…") vía `kind: "step"` en las rondas |
| Multi-patrón | El LLM devuelve **array** (máx. 10); un PDF/web puede contener varios |
| Flujo dashboard | Human-in-the-loop: checkbox "si contiene varios, crear todos / preguntarme" (default: preguntar) |
| PDF escaneado | Si el texto extraído **no tiene indicios de patrón** → rasterizar páginas del PDF a buena resolución y procesar por **visión** |
| Portadas | Automática (la más representativa, `pickCoverImage` existente) salvo human-in-the-loop (CoverPicker ya existe); el EPUB lleva la portada si hay |

## Reutilización (no reinventar)

- `lib/pattern-source.ts`: PDF (unpdf) / DOCX (mammoth) / scraping web + anti-bot,
  `pickCoverImage`, `collectCoverCandidates`, `loadPatternImages`, `saveChosenCover`.
- `lib/ai/standardize-pattern.ts`: LLM con `generateObject` + esquema zod.
- Editor online (`PatternEditor`) → se extrae a componente reutilizable con `onSave`.
- Subidas `/api/uploads` (kind `patterns`, trampa #10) y `CoverPicker`.
- Ajustes IA multi-proveedor (`lib/ai/provider.ts`, trampa #11: structured outputs).

---

## Fase 1 — Contrato multi-patrón + pasos custom ✅

- [x] `standardize-pattern.shared.ts`:
  - [x] `kind: z.enum(["round","step"]).nullish()` en rondas (`"step"` = instrucción
    intercalada sin conteo; ausente/`"round"` = ronda normal → retrocompatible).
  - [x] `standardizedPatternsSchema` = `{ patterns: StandardizedPattern[] }`.
  - [x] `normalizeStandardizedPatterns()`: descarta patrones vacíos (bug conocido),
    cap 10 (`MAX_PATTERNS_PER_CALL`), normaliza cada uno.
  - [x] `parseStandardizedPatternsContent()`: lee `{patterns:[…]}`, array plano o
    patrón único legado (→ array).
- [x] `standardize-pattern.ts`: prompts multi-patrón ("devuelve TODOS los que
  encuentres en orden, cada uno completo; si no hay, array vacío; no inventes") y
  explicación de `kind:"step"`. `standardizePattern` / `standardizePatternFromContent`
  / `standardizePatternFromImages` devuelven `StandardizedPattern[]`.
- [x] `actions.ts`: `standardizeAndSave` y `standardizePatternManual` adaptados
  (0 → ERROR "no se detectó ningún patrón"; 1 → DONE con JSON individual; N>1 →
  `aiStatus: "MULTIPLE"` con `{patterns:[…]}` en `standardizedContent`).
- [x] `PatternAiStatus` + `AiStatusBadge` + i18n para el estado MULTIPLE.
- [x] Tests actualizados en `standardize-pattern.test.ts`.

## Fase 2 — Fallback PDF→visión (PDF escaneado) ✅

- [x] `looksLikePatternText(text)`: heurística regex (rondas `R\d+`/`ronda N`,
  abreviaturas pb/pa/sc/dc/hdc/aum/dism, anillo mágico, puntadas totales…). Pura + test.
  SOLO decide qué contenido enviar al LLM: el parsing SIEMPRE es IA.
- [x] `extractPatternContent(source)`: extrae texto → si hay indicios o no es PDF,
  devuelve `{ text }`; si no hay indicios y es PDF → rasteriza páginas
  (`renderPageAsImage` de unpdf, scale ~2, máx ~10 págs, `@napi-rs/canvas`) y
  devuelve `{ images }` (data-URLs) para el camino de visión.
- [x] `standardizeAndSave` / convertidor usan `extractPatternContent`.
- [x] Webs sin indicios: error accionable ("pega el texto o sube imágenes") — sin
  headless browser (cero sobre-ingeniería).
- [x] ⚠️ Riesgo resuelto: `renderPageAsImage` funciona en Node con
  `@napi-rs/canvas` (añadido a serverExternalPackages); en Vercel queda pendiente
  verificar el deploy.

## Fase 3 — Flujo dashboard human-in-the-loop ✅

- [x] Checkbox en `pattern-form.tsx` y `batch-form.tsx`:
  **"si contiene varios patrones: crearlos todos / preguntarme"** (default: preguntar).
  Columna `autoSplit` (migración `20260904173828_pattern_auto_split`).
- [x] `standardizeAndSave` con origen:
  - N>1 + "crear todos" → crea Patterns hermanos (título `" (2)"`…). Los ficheros
    (PDF/imágenes/portada) se COMPARTEN con el origen (sin copias de Blob);
    `deleteUploadIfUnreferenced` protege todos los borrados (update/delete/cover).
  - N>1 + "preguntar" → `aiStatus: MULTIPLE` + array JSON.
- [x] Componente de revisión `MultiPatternReview` en `[id]/page.tsx` cuando
  `MULTIPLE`: lista los detectados (título, secciones, rondas/pasos) con
  **"guardar todos"** (`keepAllPatterns`) y **"elegir uno"** (`keepPattern`).
- [x] Editor: `PatternEditorFields` reutilizable con soporte de filas
  `kind:"step"` (toggle ronda↔paso, añadir paso, sin columna de puntos); la vista
  de detalle pinta steps como línea en cursiva sin compresión de rondas.
- [x] Nada se auto-guarda sin revisión cuando hay N>1 y autoSplit off.

## Fase 4 — Exportación ✅

- [x] `lib/pattern-export.ts` (puro, cliente+servidor): `toMarkdown(pattern)`
  (rondas `- **R1**: … (12)`, steps en cursiva, tabla de abreviaturas),
  `toMarkdownAll` (concatenado con `---`), `slugifyFileName`.
- [x] `lib/pattern-export.server.ts` (server-only): `toEpub(pattern, cover?)`
  (capítulo por sección) y `toEpubAnthology(patterns, cover?)` (capítulo por
  patrón) con `epub-gen-memory` importado bajo demanda.
- [x] Portada EPUB: `File` con bytes del storage (patrones guardados) o data-URL
  / URL remota descargada (convertidor); sin portada si no hay (best-effort).
- [x] Descarga MD en cliente (Blob); EPUB vía server action (base64) en el
  convertidor y vía route handler en patrones guardados.
- [x] Tests: `pattern-export.test.ts` + `pattern-export.server.test.ts`.

## Fase 5 — Página `/dashboard/convertidor` (efímera) ✅

- [x] `page.tsx` + `convertidor-form.tsx` (client): 4 orígenes combinables —
  PDF/DOCX (sube a `/api/uploads` al elegirlo), URL web, texto pegado, imágenes
  (mismo mecanismo que `manual-standardize.tsx`).
- [x] Server action `convertPattern`: guard `auth()` → `extractPatternContent` →
  estandarizar → borrar ficheros temporales → **devuelve lista de patrones**
  (sin BD) + portada propuesta y candidatas del origen.
- [x] Resultado: cards 1..N, cada una con editor reutilizable, descarga MD/EPUB
  individual, portada propuesta + "cambiar portada" (candidatas) y "guardar en
  mis patrones" (validación + redirect al detalle).
- [x] Botones globales cuando N>1: "todo en Markdown" + "EPUB recopilatorio".
- [x] Nav item en `nav.tsx` (icono `WandSparkles`).

## Fase 6 — Export en patrones guardados ✅

- [x] `GET /api/patterns/[id]/export?format=md|epub` con guard de sesión,
  lee `standardizedContent` + `coverImagePath`, filename slugificado; MULTIPLE
  exporta la colección completa.
- [x] Botones en `[id]/page.tsx` cuando hay versión estandarizada.

## Fase 7 — Transversal ✅ (excepto verificación visual)

- [x] `npm i epub-gen-memory @napi-rs/canvas server-only` (+ alias
  `server-only/empty` en vitest.config.ts que arregla 2 suites pre-existentes).
- [x] Textos nuevos en `messages/es.json` **Y** `messages/en.json`.
- [x] Verificación: `npm run test` (163 ✓), `npm run typecheck` ✓,
  `npx eslint src` ✓ (solo warnings pre-existentes), `npm run build` ✓.
- [ ] Verificación visual Playwright del convertidor: 1280×800 y 390×844.

## Notas / límites

- Máx. 10 patrones por llamada; PDFs enormes podrían truncarse. **Mitigado**:
  textos >10k chars van en 2 fases (segmentación LLM → estandarizar cada
  segmento, concurrencia 3); comprobado con el recopilatorio de Halloween:
  10 patrones detectados (9 reales + 1 duplicado de calabaza).
- Webs protegidas por reto JS (Cloudflare): el fetch directo falla → **fallback
  automático vía proxy lector Jina** (`r.jina.ai`, renderiza con navegador real;
  SIN User-Agent: devuelve 403 a clientes suplantados; timeout 90s + 1 retry).
  Si aun así falla, el usuario puede **guardar la página como HTML (Ctrl+S) y
  subirla** — `.html` aceptado en converter y form de patrones.
- `minimax/minimax-m3:free` **NO es válido** para este pipeline: acepta imágenes
  pero ignora el json_schema e inventa campos propios + fences ```json
  (evidencia: debug raw con el schema real). Revertido a
  `dots-studio/dots-3-note-preview:free` (texto+visión+schema, el único free que
  cumple los tres). Trampa #11 aplicada.
- Los errores de las server actions van como strings en español (convención
  existente en este repo); solo la UI pasa por `messages/`.

## Verificación final

- `npm run test`: **163/163 ✓** (21 ficheros) · `typecheck` ✓ · `eslint` ✓
  (solo warnings pre-existentes) · `npm run build` ✓ (Turbopack, 2.5min).
- E2E con patrones reales (`scratchpad/pattern-parser-e2e.mts`):
  - MiniBeer PDF → 1 patrón ✓ (56s, texto).
  - Halloween PDF → **10 patrones** ✓ (411s, segmentación en 2 fases).
  - 2 imágenes mushroom → 1 patrón ✓ (112s, visión, modelo dots).
  - stitchbyfay (CF-blocked) → 1 patrón "Bell Bag Ornament", 21 rondas + 4
    pasos ✓ (78s, vía Jina).
  - oombawkadesigncrochet.com → 2 patrones (2 variantes de lana del gorro) ✓.

## Registro de progreso (novedades del 2026-09-04, sesión 3)

- **Progreso en tiempo real**: la conversión va por streaming (`POST /api/convert`,
  NDJSON) — el panel muestra el paso actual en vivo (extrayendo → texto listo →
  separando patrones → estandarizando patrón i/n → rasterizando…) + cronómetro.
  `standardizePattern`/`standardizePatternSource` aceptan `onProgress`.
- **PDF escaneado resuelto (Cat in Pumpkin)**: si el texto "parecía" patrón pero
  el LLM no encuentra nada, `standardizePatternSource` reintenta rasterizando el
  PDF y procesándolo por visión. Fix crítico: el documento debe crearse CON el
  `CanvasFactory` inyectado (`getDocumentProxy(bytes, { CanvasFactory })`), si no
  el pdf.js interno usa su stub y lanza "@napi-rs/canvas is not available".
  E2E: cat → 1 patrón, 8 secciones, 92 rondas, 9 pasos (158s).
- **LOKI**: subida fallida por MIME vacío del navegador → `resolveUploadMime`
  infiere el MIME de la extensión; errores de subida con motivo concreto
  («fichero», tipo, tamaño) + aviso cliente del límite de ~4,4 MB de Vercel.
  E2E: loki → 1 patrón, 9 secciones, 74 rondas (188s).
- **Prompt "todo el texto relevante"**: regla general explícita — nada relevante
  se descarta; mapa de qué va a cada sitio (rondas/steps/tips→notas de sección/
  metadatos/assemblyNotes); solo se omite ruido de maquetación.
- **error.tsx** en `[locale]`: los fallos muestran el mensaje real con digest y
  botón de reintentar (antes: página pelada de Vercel). Guardar/exportar en el
  convertidor con try/catch + mensajes en cliente.
- Pendiente de reproducir: "This page couldn't load" de Vercel al guardar (la
  fila NO llegó a crearse en BD). Sin acceso a logs de Vercel (token CLI
  inválido); tras este deploy el error real se verá en la app si persiste.

## Registro de progreso (novedades del 2026-09-04, sesión 2)

- **minimax-m3:free descartado con evidencia** (inventa schema + fences; solo
  acepta imágenes). Modelo activo en BD: `dots-studio/dots-3-note-preview:free`.
- **Segmentación en 2 fases** para textos largos (>10k chars): Halloween pasa de
  1 patrón colapsado a **10 patrones**.
- **Fallback Cloudflare**: proxy lector Jina automático al estar bloqueado; fix
  del UA (403 a clientes suplantados). URL real de stitchbyfay → convierte ✓.
- **Plan B manual**: subida de `.html` (página guardada con Ctrl+S) aceptada en
  converter y form de patrones (`text/html` en DOCUMENT_MIME_TO_EXT).
- **Portadas completas** (feedback de prueba online): subida manual de portada
  por card en el convertidor (con limpieza de huérfanos al descartar),
  `saveConvertedPattern` persiste la portada (data-URL/URL/pathname), EPUB
  normaliza a **portada de libro 1600×2560** (recorte centrado, JPEG q85 vía
  `@napi-rs/canvas`), y el Markdown lleva la portada como imagen inicial
  (data-URI autocontenida en el export de patrones guardados).
- **Guardar sin salir de resultados**: el botón guarda con toast + enlace
  "Ver en patrones" y deja seguir guardando el resto de patrones del lote.
- **Export en el listado** de patrones: enlaces MD/EPUB por fila/carta
  (misma ruta `/api/patterns/[id]/export`, mismo sistema que el convertidor).
- **Fix crítico**: faltaban los hidden inputs `filePath`/`imagePaths` en el form
  del convertidor (la IA no recibía nada al convertir) + panel de progreso con
  cronómetro durante la conversión.
- **Guardar en el convertidor (500 resuelto)**: las candidatas de portada de
  PDF se codificaban como PNG a tamaño completo (varios MB en base64) y la
  server action de guardar superaba el `bodySizeLimit` de 4 MB → 500 antes de
  ejecutarse, sin crear la fila (el "This page couldn't load" pendiente de
  reproducir). Ahora `pdfImageCandidates` reduce cada candidata a JPEG de
  previsualización (máx. 1200 px, q80, fondo blanco si hay alfa) y descarta
  cualquiera que pese >700 KB. Además faltaban las claves i18n
  `Convertidor.showEditor`/`hideEditor` (añadidas a es/en).
- **Estandarizar con progreso en vivo en el detalle del patrón**: el botón
  "Estandarizar" ya no usa la action bloqueante; llama a la nueva ruta de
  streaming `POST /api/patterns/[id]/standardize` (mismo contrato NDJSON que
  `/api/convert`) y muestra el MISMO panel de progreso (pasos + cronómetro).
  La persistencia del pipeline (standardizeAndSave, hermanos multi-patrón,
  borrados protegidos) se extrajo a `lib/patterns/standardize-persist.ts`,
  compartida por la orquestación `after()` y la ruta; el panel/cronómetro/
  lector NDJSON viven en `components/form/convert-progress.tsx`, reutilizados
  por el convertidor. `standardizePatternAction` desaparece (la ruta la
  sustituye).
- **Subidas grandes en Vercel**: el límite de ~4,5 MB de las funciones impedía
  enviar PDFs de 4,7 MB por `/api/uploads`. Los ficheros de patrones que superan
  ese umbral piden un token en `/api/uploads/client` y se suben DIRECTOS a
  Vercel Blob (2,7 s para 4,74 MB verificado contra el store real). Dos claves
  del diagnóstico:
  - El store de producción es **PRIVADO**: con `access:"public"` la API
    contesta 400 SIN cabeceras CORS → el navegador bloquea el cuerpo del error
    → el SDK reintenta 10 veces resubiendo el fichero entero → cuelgue + "The
    request was aborted". Por eso Vercel no logueaba nada: los bytes van
    directo del navegador a la API de Blob.
  - La detección del modo NO puede usar `get()`/`head()` de sonda: en un store
    privado responden "no encontrado" también con modo público. La sonda
    fiable es `put()` de un fichero mínimo + `del()` (`getBlobAccess()` en
    `files.server.ts`, memorizado por proceso). Reproducido con token real:
    probe public → rechazado, probe private → OK.
  - El 98-99% congelado es normal: el SDK no emite el 100% hasta que el store
    confirma; la UI muestra "Finalizando…" a partir de 99.
  Estrategia en dos intentos: 1º con progreso (streaming); si falla, 2º por la
  ruta fetch clásica sin streaming, 90 s por intento y pathname nuevo por
  intento. Sin fallback silencioso a la ruta limitada. En desarrollo local
  (sin Blob) sigue la ruta normal, que guarda en disco hasta 25 MB. Los
  patrones guardados conservan siempre `filePath`/`imagePaths` para consultar
  el original; solo los ficheros temporales del convertidor se borran al
   terminar la conversión.

## OPDS (rama feat/opds)

- `GET /api/opds` — catálogo DIRECTO: la lista de patrones estandarizados
  como feed de adquisición (sin navegación ni secciones, a petición del
  usuario: "recopilatorios" confundía y no funcionaba). Auxiliares bajo
  `/api/opds/...`: `patrones` (alias), `osd` (OpenSearch) y `search?q=` (o
  `/search/<término>`). Con resumen (secciones/rondas), portada vía
  `/api/files` (imágenes públicas), idioma `dcterms:language` y enlaces de
  adquisición a la exportación existente
  (`/api/patterns/[id]/export?format=epub|md`).
- Autenticación dual en `lib/opds.server.ts`: sesión web (cookies) **o**
  HTTP Basic contra la tabla `User` (bcrypt). La ruta de export comparte el
  mismo guard, así que los lectores OPDS (Moon+ Reader, Kybook, ReadEra…) se
  añaden con la URL `https://<dominio>/api/opds` y el email/contraseña del
  login. Un 401 lleva el reto `WWW-Authenticate: Basic`.
- XML puro en `lib/opds.ts` (escape, parseo Basic, feed) con tests
  (`opds.test.ts`); sin dependencias nuevas. Credenciales: el email y la
  contraseña del login de la plataforma (auth Basic contra la tabla `User`).
- **Portada del EPUB como primera página**: epub-gen-memory solo escribe
  `OEBPS/cover.<ext>` como metadato (sin página) y descarga las <img> del
  contenido con node-fetch (sin data:). `withCoverPage` post-procesa el ZIP
  con `jszip`: inserta `OEBPS/cover-page.xhtml` (que referencia el cover
  relativo) y lo pone como PRIMER item del spine. La portada se normaliza
  antes a 1600×2560 (y `plausibleImage` filtra datos corruptos: @napi-rs/
  canvas puede cascar NATIVAMENTE con bytes truncados, salvando el try/catch).

## Novedades 2026-09-05 (master)

- **Guardia anti-alucinación en la segmentación**: si el normalizador detecta
  ≥3 "patrones" con un solo título distinto (el mismo texto troceado N veces,
  visto con Hollow Knight), reintenta en UNA llamada con el texto completo.
  Además `normalizeStandardizedPatterns` elimina duplicados exactos (título +
  rondas idénticas; las variantes con igual título y contenido distinto se
  conservan). Helpers puros: `dedupeIdenticalPatterns` y
  `looksLikeDuplicateSplit` (con tests).
- **Guardar el origen con el patrón (convertidor)**: `/api/convert` ya no
  borra los ficheros subidos cuando la conversión tiene éxito; el evento done
  lleva `source` (filePath/externalUrl/imagePaths) y `saveConvertedPattern`
  los persiste en el Pattern (igual que el resto de flujos). Al descartar los
  resultados ("Nueva conversión" o nueva búsqueda) la action
  `discardConvertedSource` borra los ficheros solo si ningún patrón guardado
  los sigue usando. Si el guardado de la portada falla, el patrón se guarda
  sin ella y queda warning en los logs.
- **Portadas que no se guardaban (fix)**: `resolveUploadMime` validaba el
  MIME declarado contra `EXT_TO_MIME` (extensión→MIME) — lookup siempre
  falso. Todo File con nombre real (".jpg") se salvaba por el fallback de
  extensión, pero las portadas se crean como File "cover" SIN extensión
  (saveChosenCover, saveConvertedPattern, setPatternCover) → "tipo no
  reconocido" → sin portada / "No se pudo guardar la portada". Ahora el type
  declarado se valida contra los mapas de MIME (imagen/documento).
  Reproducido y verificado contra el store real con data-URLs JPEG.
- **No re-estandarizar al cambiar el fichero**: si al editar un patrón cambia
  el origen pero ya está estandarizado (DONE o MULTIPLE), se conserva la
  versión; solo se resetea a PENDING (y se programa la IA) si no había
  versión. Regenerar a mano queda en el botón "Estandarizar" del detalle.

## Registro de progreso

- 2026-09-04 — Spec creado.
- 2026-09-04 — **Fase 1 completada** ✅: contrato multi-patrón (`standardizedPatternsSchema`,
  `MAX_PATTERNS_PER_CALL = 10`, `normalizeStandardizedPatterns`, `parseStandardizedPatternsContent`),
  `kind:"step"` en rondas (retrocompatible), prompts multi-patrón, `aiStatus: MULTIPLE`
  (validations + badge + i18n es/en), actions `standardizeAndSave`/`standardizePatternManual`
  adaptadas (0→ERROR, 1→DONE individual, N→MULTIPLE). Tests: 10/10 ok, typecheck + lint limpios.
  Fallos pre-existentes NO relacionados: `files.test.ts`/`pattern-source.test.ts`
  (paquete `server-only` no resuelto en vitest), 1 timeout en `settings.test.ts`
  y 2 workers lentos (máquina lenta).
- 2026-09-04 — **Fase 2 completada** ✅: `looksLikePatternText` (heurística solo como
  ROUTER texto-vs-visión, el parsing SIEMPRE es IA), `rasterizePdfPages` (unpdf
  `renderPageAsImage` + `@napi-rs/canvas`, scale 2, máx 10 págs), `extractPatternContent`
  unificado (imágenes → visión; texto con indicios → texto; PDF escaneado → render;
  si el render falla pero hay texto → texto tal cual; webs/DOCX sin indicios → error
  accionable). Deps instaladas: `@napi-rs/canvas`, `epub-gen-memory`, `server-only` (dev,
  arregla 2 suites pre-existentes) + alias `server-only/empty` en vitest.config.ts.
  Tests 37/37 ok. NOTA: el parsing del patrón es 100% LLM (generateObject) — la
  heurística solo decide QUÉ contenido enviar, no extrae datos.
- 2026-09-04 — **Modelo IA recomendado** (OpenRouter, gratuito, estructurado+visión
  verificado contra el catálogo real): `dots-studio/dots-3-note-preview:free` (el único
  free con imagen + structured_outputs, ctx 512k). Fallback text-only:
  `nvidia/nemotron-3-super-120b-a12b:free` (ya validado en trampa #11). Configurable
  en /dashboard/ajustes o env `AI_MODEL`.
- 2026-09-04 — **Fase 3 completada** ✅: columna `autoSplit` (migración
  `20260904173828_pattern_auto_split`), checkbox en `pattern-form` y `batch-form`,
  `standardizeAndSave` con origen (autoSplit→hermanos compartiendo ficheros,
  `deleteUploadIfUnreferenced` protege los borrados), acciones `keepPattern`/
  `keepAllPatterns` + componente `MultiPatternReview` en el detalle, badge MULTIPLE,
  editor extraído a `PatternEditorFields` (reutilizable, con soporte de pasos:
  toggle ronda↔paso, añadir paso) y vista de detalle pinta `kind:"step"` en cursiva
  sin compresión. Typecheck + lint limpios, tests 26/26.
- 2026-09-04 — **Fase 5 completada** ✅: página `/dashboard/convertidor` (form con
  4 orígenes combinables + vista de resultados 1..N). Action `convertPattern`
  (efímero, borra uploads temporales, devuelve patrones + portada propuesta +
  candidatas), `saveConvertedPattern` (valida contrato, crea Pattern DONE) y
  `exportPatternEpub` (EPUB en memoria → base64). Cada card: editor reutilizable
  (`PatternEditorFields`), descarga MD en cliente, EPUB vía action, portada
  cambiable entre candidatas, guardar→redirect al detalle. Barra global con MD
  concatenado + EPUB recopilatorio cuando N>1. Nav `Convertidor` + i18n es/en.
- 2026-09-04 — **Fase 6 completada** ✅: `GET /api/patterns/[id]/export?format=md|epub`
  (guard de sesión, MULTIPLE → colección, portada del Blob, filename slugificado)
  + botones Markdown/EPUB en el detalle del patrón.
- 2026-09-04 — **Fix de bundling**: `epub-gen-memory` arrastra `ejs`/`fs` → los
  constructores EPUB se separaron a `pattern-export.server.ts` (con `server-only`);
  `pattern-export.ts` queda puro (Markdown/slug) para el cliente. Añadido
  `serverExternalPackages: ["@napi-rs/canvas"]` en next.config.ts. Build de
  producción OK. Suite completa: 21 ficheros / 163 tests ✓.
- 2026-09-04 — **PRUEBA REAL con /patterns** ✅ (script `scratchpad/pattern-parser-e2e.mts`):
  - `MiniBeerPattern.pdf` (texto): 1 patrón "Mini Beer Mug", 18 rondas, aguja 5mm ✓ (56s).
  - `Halloween recopilation.pdf` (texto): 1 patrón "Medium-size Pumpkin", 22 rondas
    + 2 pasos; el modelo colapsa variantes en uno — coincide con la limitación de
    robustez ya anotada (plan B: segmentación en 2 fases) ⚠️.
  - `image_mushroom_part1/2.png` (visión): 1 patrón "Seta Toadstool", 20 rondas ✓ (112s)
    — requiere modelo con visión: el actual de BD (`nemotron…:free`) NO tiene imagen
    ("No endpoints found that support image input"); probado con
    `dots-studio/dots-3-note-preview:free` y restaurado. Cambiar en /dashboard/ajustes.
  - Web (link_web_pattern.txt): stitchbyfay.com está tras reto Cloudflare (403) →
    error accionable correcto. En un sitio CF sin reto se detectó un FALSO POSITIVO
    en `looksLikeBotChallenge` (el script JSD normal de CF: `challenge-platform/
    scripts/jsd/main.js`); corregido el regex (solo `cf_chl`, `orchestrate/chl_page`,
    "Just a moment", "Enable JavaScript and cookies") + cabecera `cf-mitigated`.
    Retest con oombawkadesigncrochet.com: **2 patrones detectados** (variantes del
    gorro) con 20/17 rondas y 17/14 pasos ✓ (148s).
