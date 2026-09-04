import { readUpload } from "@/lib/files.server";
import { EXT_TO_MIME, isValidUploadPath } from "@/lib/files";
import { auth } from "@/lib/auth";
import {
  parseStandardizedPatternsContent,
} from "@/lib/ai/standardize-pattern";
import {
  slugifyFileName,
  toMarkdown,
  toMarkdownAll,
} from "@/lib/pattern-export";
import { toEpub, toEpubAnthology } from "@/lib/pattern-export.server";
import { prisma } from "@/lib/prisma";

// Descarga de la versión estandarizada de un patrón guardado.
//   GET /api/patterns/[id]/export?format=md|epub
// Con varios patrones detectados (MULTIPLE) exporta la colección completa.

function unauthorized(): Response {
  return new Response("No autorizado", { status: 401 });
}

function notFound(): Response {
  return new Response("Patrón no encontrado o sin versión estandarizada", {
    status: 404,
  });
}

async function coverFile(
  path: string | null,
): Promise<File | undefined> {
  if (!path || !isValidUploadPath(path)) return undefined;
  const bytes = await readUpload(path);
  if (!bytes) return undefined;
  const content =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(await new Response(bytes).arrayBuffer());
  const ext = path.slice(path.lastIndexOf(".")) || ".jpg";
  const mime = EXT_TO_MIME[ext] ?? "image/jpeg";
  return new File([content as BlobPart], `cover${ext}`, { type: mime });
}

/** Portada como data-URI para el Markdown (fichero autocontenido). */
async function coverDataUri(path: string | null): Promise<string | null> {
  if (!path || !isValidUploadPath(path)) return null;
  const bytes = await readUpload(path);
  if (!bytes) return null;
  const content =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(await new Response(bytes).arrayBuffer());
  const ext = path.slice(path.lastIndexOf(".")) || ".jpg";
  const mime = EXT_TO_MIME[ext] ?? "image/jpeg";
  return `data:${mime};base64,${Buffer.from(content).toString("base64")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const { id } = await params;
  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: { title: true, standardizedContent: true, coverImagePath: true },
  });
  if (!pattern?.standardizedContent) return notFound();

  const patterns = parseStandardizedPatternsContent(pattern.standardizedContent);
  if (patterns.length === 0) return notFound();

  const format =
    new URL(request.url).searchParams.get("format") === "epub" ? "epub" : "md";
  const base = slugifyFileName(pattern.title);

  if (format === "md") {
    const coverUri = await coverDataUri(pattern.coverImagePath);
    const markdown =
      patterns.length === 1
        ? toMarkdown(patterns[0]!, coverUri)
        : toMarkdownAll(patterns, coverUri);
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.md"`,
      },
    });
  }

  const cover = await coverFile(pattern.coverImagePath);
  const bytes =
    patterns.length === 1
      ? await toEpub(patterns[0]!, cover)
      : await toEpubAnthology(patterns, cover);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${base}.epub"`,
    },
  });
}
