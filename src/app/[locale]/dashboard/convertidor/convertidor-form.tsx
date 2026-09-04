"use client";

import {
  CircleAlert,
  CircleCheck,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Pencil,
  Save,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import {
  type StandardizedPattern,
} from "@/lib/ai/standardize-pattern";
import {
  uploadBodyLimitError,
} from "@/lib/files";
import {
  slugifyFileName,
  toMarkdown,
  toMarkdownAll,
} from "@/lib/pattern-export";
import { PatternEditorFields } from "../patrones/[id]/editor/pattern-editor-fields";
import {
  deleteConvertCover,
  exportPatternEpub,
  saveConvertedPattern,
  type ConvertResult,
  type ConvertState,
  type ConvertStreamEvent,
} from "./actions";

/**
 * Llama a POST /api/convert y reparte los eventos NDJSON de progreso en vivo.
 */
async function convertViaStream(
  formData: FormData,
  onEvent: (event: ConvertStreamEvent) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/convert", { method: "POST", body: formData });
  } catch {
    onEvent({ type: "error", message: "La conversión falló, vuelve a intentarlo" });
    return;
  }
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: "La conversión falló, vuelve a intentarlo" });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as ConvertStreamEvent);
      } catch {
        // Línea corrupta: se ignora.
      }
    }
  }
}

type Covers = { auto: string | null; candidates: string[] };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  downloadBlob(new Blob([bytes], { type: mime }), filename);
}

function ConvertButton({
  disabled,
  pending,
}: {
  disabled?: boolean;
  pending?: boolean;
}) {
  const t = useTranslations("Convertidor");
  return (
    <Button type="submit" disabled={pending || disabled}>
      <WandSparkles />
      {pending ? t("converting") : t("convert")}
    </Button>
  );
}

/** Segundos → "m:ss" para el cronómetro de conversión. */
function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Portada para el Markdown: si es un fichero subido se convierte a data-URL
 * (el .md debe verse bien fuera de la app); si es data-URL o URL remota, tal cual.
 */
async function coverForMarkdown(
  coverPath: string | null,
  coverSrc: string | null,
): Promise<string | null> {
  if (!coverPath && !coverSrc) return null;
  if (!coverPath) return coverSrc;
  try {
    const res = await fetch(`/api/files/${coverPath}`);
    if (!res.ok) return coverSrc;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : coverSrc);
      reader.onerror = () => resolve(coverSrc);
      reader.readAsDataURL(blob);
    });
  } catch {
    return coverSrc;
  }
}

/**
 * Panel de progreso con el paso actual en vivo (el pipeline emite eventos por
 * streaming) más cronómetro: la IA tarda 1-3 min por patrón y sin feedback
 * parece colgado.
 */
function ConvertingPanel({
  seconds,
  step,
}: {
  seconds: number;
  step: string | null;
}) {
  const t = useTranslations("Convertidor");
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4">
      <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {step ?? t("convertingTitle")}
        </p>
        <p className="text-xs text-muted-foreground">{t("convertingHint")}</p>
      </div>
      <span className="ml-auto shrink-0 tabular-nums text-sm text-muted-foreground">
        {formatElapsed(seconds)}
      </span>
    </div>
  );
}

/** Traduce un evento del pipeline a un mensaje de paso para la UI. */
function useStepLabel(): (event: ConvertStreamEvent) => string | null {
  const t = useTranslations("Convertidor");
  return (event) => {
    switch (event.type) {
      case "extract":
        return t("stepExtract");
      case "text-ready":
        return t("stepTextReady", { chars: event.chars.toLocaleString() });
      case "images-ready":
        return t("stepImagesReady", { count: event.count });
      case "standardizing":
        return t("stepStandardizing");
      case "segmenting":
        return t("stepSegmenting");
      case "segment":
        return t("stepSegment", { index: event.index, total: event.total });
      case "rasterizing":
        return t("stepRasterizing");
      case "vision-retry":
        return t("stepVisionRetry");
      default:
        return null;
    }
  };
}

function uploadOne(file: File): Promise<string | null> {
  return (async () => {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", "patterns");
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = (await res.json().catch(() => null)) as
      | { path?: string; error?: string }
      | null;
    return res.ok && data?.path ? data.path : null;
  })();
}

// ---------------------------------------------------------------------------
// Card de resultado: previsualización + editor + portada + descargas + guardar.
// El documento editado vive en la card; el padre lo consulta vía onDocChange.
// ---------------------------------------------------------------------------

function PatternResultCard({
  initial,
  covers,
  onDocChange,
}: {
  initial: StandardizedPattern;
  covers: Covers;
  onDocChange: (next: StandardizedPattern) => void;
}) {
  const t = useTranslations("Convertidor");
  const tForms = useTranslations("Forms");
  const tPatterns = useTranslations("Patterns");
  const [doc, setDoc] = useState(initial);
  // Portada: src automático/candidata (data-URL/URL) o fichero subido por el
  // usuario (pathname del storage, mostrado vía /api/files).
  const [coverSrc, setCoverSrc] = useState<string | null>(covers.auto);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const coverCleanupRef = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const coverDisplay = coverPath ? `/api/files/${coverPath}` : coverSrc;
  const baseName = slugifyFileName(doc.title || "patron");

  async function downloadMarkdown() {
    const coverUri = await coverForMarkdown(coverPath, coverSrc);
    downloadBlob(
      new Blob([toMarkdown(doc, coverUri)], {
        type: "text/markdown;charset=utf-8",
      }),
      `${baseName}.md`,
    );
  }

  function downloadEpub() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await exportPatternEpub({
          patterns: [doc],
          coverSrc: coverPath ?? coverSrc,
          anthology: false,
        });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        downloadBase64(
          result.base64,
          `${baseName}.epub`,
          "application/epub+zip",
        );
      } catch {
        setError("No se pudo generar el EPUB, vuelve a intentarlo");
      }
    });
  }

  /** Guarda el patrón (con su portada) sin abandonar los resultados: en
   *  conversiones multi-patrón se pueden guardar varios seguidos. */
  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveConvertedPattern(doc, coverPath ?? coverSrc);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        // La portada subida ya pertenece al patrón: no hay que limpiarla.
        coverCleanupRef.current = null;
        setSavedId(result.id);
        toast.success(t("savedToast"));
        router.refresh();
      } catch {
        setError("No se pudo guardar el patrón, vuelve a intentarlo");
      }
    });
  }

  /** Sube la portada elegida y la usa en este patrón (reemplaza la anterior). */
  async function onPickCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const limitError = uploadBodyLimitError(file);
    if (limitError) {
      setError(limitError);
      return;
    }
    setUploadingCover(true);
    setError(null);
    try {
      const path = await uploadOne(file);
      if (!path) {
        setError(tForms("uploadFailed"));
        return;
      }
      if (coverCleanupRef.current) {
        await deleteConvertCover(coverCleanupRef.current);
      }
      coverCleanupRef.current = path;
      setCoverPath(path);
      setCoverSrc(null);
    } finally {
      setUploadingCover(false);
    }
  }

  function removeCover() {
    if (coverCleanupRef.current) {
      void deleteConvertCover(coverCleanupRef.current);
      coverCleanupRef.current = null;
    }
    setCoverPath(null);
    setCoverSrc(null);
  }

  const rounds = doc.sections.reduce(
    (sum, section) => sum + section.rounds.length,
    0,
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          {coverDisplay ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverDisplay}
              alt={doc.title}
              className="size-20 rounded-xl border object-cover"
            />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <ImageIcon className="size-7" />
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate text-lg font-semibold">{doc.title}</h3>
            <p className="text-sm text-muted-foreground">
              {tPatterns("multiPatternMeta", {
                sections: doc.sections.length,
                rounds,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadMarkdown}>
              <Download />
              {t("downloadMd")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={downloadEpub}
            >
              <Download />
              {t("downloadEpub")}
            </Button>
            {savedId ? (
              <>
                <Button size="sm" variant="secondary" disabled>
                  <CircleCheck />
                  {t("savedState")}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/patrones/${savedId}`}>
                    {t("viewSaved")}
                  </Link>
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={busy} onClick={save}>
                <Save />
                {t("savePattern")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setShowEditor((v) => !v)}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            {showEditor ? t("hideEditor") : t("showEditor")}
          </button>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {uploadingCover ? tForms("uploading") : t("uploadCover")}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickCover}
          />
          {covers.candidates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCandidates((v) => !v)}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ImageIcon className="size-3.5" />
              {t("changeCover")}
            </button>
          )}
          {coverDisplay && (
            <button
              type="button"
              onClick={removeCover}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="size-3.5" />
              {t("removeCover")}
            </button>
          )}
        </div>

        {showCandidates && (
          <div className="flex flex-wrap gap-2 rounded-xl border p-3">
            {covers.candidates.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                onClick={() => {
                  if (coverCleanupRef.current) {
                    void deleteConvertCover(coverCleanupRef.current);
                    coverCleanupRef.current = null;
                    setCoverPath(null);
                  }
                  setCoverSrc(src);
                  setShowCandidates(false);
                }}
                className={`size-16 cursor-pointer rounded-lg border object-cover transition-opacity hover:opacity-80 ${
                  coverSrc === src ? "ring-2 ring-primary" : ""
                }`}
              />
            ))}
          </div>
        )}

        {showEditor && (
          <div className="border-t pt-4">
            <PatternEditorFields
              doc={doc}
              setDoc={(updater) => {
                const next = updater(doc);
                setDoc(next);
                onDocChange(next);
              }}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Vista de resultados (1..N patrones detectados).
// ---------------------------------------------------------------------------

function ResultsView({
  result,
  editsRef,
  onReset,
}: {
  result: ConvertResult;
  editsRef: React.RefObject<Map<number, StandardizedPattern>>;
  onReset: () => void;
}) {
  const t = useTranslations("Convertidor");
  const [allBusy, startAllTransition] = useTransition();
  const [allError, setAllError] = useState<string | null>(null);

  const patterns = result.patterns;
  const covers: Covers = {
    auto: result.autoCover,
    candidates: result.coverCandidates,
  };

  /** Documentos vigentes: originales + ediciones de las cards. */
  function currentDocs(): StandardizedPattern[] {
    return patterns.map((pattern, index) =>
      editsRef.current?.get(index) ?? pattern,
    );
  }

  function downloadAllMarkdown() {
    downloadBlob(
      new Blob([toMarkdownAll(currentDocs(), covers.auto)], {
        type: "text/markdown;charset=utf-8",
      }),
      "patrones.md",
    );
  }

  function downloadAllEpub() {
    setAllError(null);
    startAllTransition(async () => {
      const exportResult = await exportPatternEpub({
        patterns: currentDocs(),
        coverSrc: covers.auto,
        anthology: true,
      });
      if ("error" in exportResult) {
        setAllError(exportResult.error);
        return;
      }
      downloadBase64(
        exportResult.base64,
        "patrones.epub",
        "application/epub+zip",
      );
    });
  }

  return (
    <div className="space-y-5">
      {patterns.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed p-4">
          <p className="text-sm font-medium">
            {t("allDetected", { count: patterns.length })}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadAllMarkdown}>
              <Download />
              {t("downloadAllMd")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={allBusy}
              onClick={downloadAllEpub}
            >
              <Download />
              {t("downloadAllEpub")}
            </Button>
          </div>
          {allError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {allError}
            </p>
          )}
        </div>
      )}

      {patterns.map((pattern, index) => (
        <PatternResultCard
          key={index}
          initial={pattern}
          covers={covers}
          onDocChange={(next) => editsRef.current?.set(index, next)}
        />
      ))}

      <Button variant="outline" onClick={onReset}>
        <WandSparkles />
        {t("newConversion")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulario del convertidor.
// ---------------------------------------------------------------------------

export function ConvertidorForm() {
  const t = useTranslations("Convertidor");
  const tForms = useTranslations("Forms");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ConvertState>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Paso actual del pipeline (progreso en vivo vía streaming).
  const [step, setStep] = useState<string | null>(null);
  const toStepLabel = useStepLabel();
  // Ediciones de las cards por índice (el resultado base vive en `result`).
  const editsRef = useRef<Map<number, StandardizedPattern>>(new Map());
  // Contador de conversiones: repone el árbol de resultados entre intentos.
  const [conversionCount, setConversionCount] = useState(0);
  // Cronómetro de conversión (feedback de actividad). El reset va en el event
  // handler; el effect solo programa el tictac mientras la conversión corre.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  function onSubmit(formData: FormData) {
    setElapsed(0);
    setStep(null);
    startTransition(async () => {
      let next: ConvertState = null;
      await convertViaStream(formData, (event) => {
        if (event.type === "done") {
          next = {
            patterns: event.patterns,
            autoCover: event.autoCover,
            coverCandidates: event.coverCandidates,
          };
          return;
        }
        if (event.type === "error") {
          next = { error: event.message };
          return;
        }
        setStep(toStepLabel(event));
      });
      if (next && "patterns" in next) {
        setConversionCount((count) => count + 1);
        editsRef.current = new Map();
      }
      setStep(null);
      setResult(next);
    });
  }

  function onPickUpload(
    event: ChangeEvent<HTMLInputElement>,
    onDone: (path: string) => void,
  ) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const limitError = uploadBodyLimitError(file);
    if (limitError) {
      input.value = "";
      setUploadError(limitError);
      return;
    }
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        const path = await uploadOne(file);
        if (path) {
          onDone(path);
        } else {
          input.value = "";
          setUploadError(tForms("uploadFailed"));
        }
      } finally {
        setUploading(false);
      }
    })();
  }

  function onPickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const oversize = files.find((file) => uploadBodyLimitError(file));
    if (oversize) {
      setUploadError(uploadBodyLimitError(oversize));
      return;
    }
    setUploadError(null);
    setUploading(true);
    void (async () => {
      try {
        for (const file of files) {
          const path = await uploadOne(file);
          if (path) {
            setImagePaths((current) => [...current, path]);
          } else {
            setUploadError(tForms("uploadFailed"));
          }
        }
      } finally {
        setUploading(false);
      }
    })();
  }

  function reset() {
    setResult(null);
    setFilePath(null);
    setImagePaths([]);
    setUploadError(null);
    editsRef.current = new Map();
  }

  if (result && "patterns" in result) {
    return (
      <ResultsView
        key={conversionCount}
        result={result}
        editsRef={editsRef}
        onReset={reset}
      />
    );
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-5">
      {/* Los ficheros ya están subidos a /api/uploads: la action solo recibe
          los pathnames (el input file no viaja en el FormData de la action). */}
      <input type="hidden" name="filePath" value={filePath ?? ""} />
      <input
        type="hidden"
        name="imagePaths"
        value={JSON.stringify(imagePaths)}
      />

      <div className="space-y-2">
        <Label htmlFor="file">
          {t("fieldFile")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        {filePath && (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <CircleCheck className="size-4" />
            {t("fileReady")}
          </p>
        )}
        <Input
          id="file"
          type="file"
          accept=".pdf,.docx,.html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
          onChange={(event) => onPickUpload(event, setFilePath)}
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">
          {t("fieldImages")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        {imagePaths.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imagePaths.map((path) => (
              <div key={path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${path}`}
                  alt=""
                  className="size-16 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImagePaths((current) =>
                      current.filter((entry) => entry !== path),
                    )
                  }
                  aria-label={tForms("delete")}
                  className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={onPickImages}
        />
        <p className="text-xs text-muted-foreground">{t("imagesHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalUrl">
          {t("fieldUrl")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="externalUrl"
          name="externalUrl"
          type="url"
          placeholder="https://…"
        />
        <p className="text-xs text-muted-foreground">{t("urlHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">
          {t("fieldText")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Textarea
          id="text"
          name="text"
          rows={6}
          placeholder={t("textPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("textHint")}</p>
      </div>

      {uploadError && (
        <p role="alert" className="text-sm text-destructive">
          {uploadError}
        </p>
      )}
      {uploading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {tForms("uploading")}
        </p>
      )}
      {pending && <ConvertingPanel seconds={elapsed} step={step} />}
      {result && "error" in result && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-destructive"
        >
          <CircleAlert className="size-4" />
          {result.error}
        </p>
      )}

      <div className="flex gap-3">
        <ConvertButton disabled={uploading} pending={pending} />
      </div>
    </form>
  );
}
