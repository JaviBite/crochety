import "server-only";

import type { StandardizedPattern } from "@/lib/ai/standardize-pattern";
import {
  type SourceProgress,
  standardizePatternSource,
} from "@/lib/ai/standardize-source";
import { isValidUploadPath } from "@/lib/files";
import { deleteUpload } from "@/lib/files.server";
import {
  parseImagePaths,
  type PatternSource,
  PatternSourceError,
} from "@/lib/pattern-source";
import { prisma } from "@/lib/prisma";
import { tagsCreateInput } from "@/lib/tags";

// Persistencia del pipeline de estandarización sobre patrones guardados:
// extraer contenido del origen → estandarizar → guardar JSON.
// aiStatus: PENDING (en cola) → PROCESSING → DONE | ERROR | MULTIPLE.
// Un mismo origen (PDF/web) puede contener varios patrones: o se crean todos
// como Patterns (autoSplit) o se apuntan todos y el usuario elige en el
// detalle cuáles convertir en patrones (MULTIPLE, human-in-the-loop).
// Lo usan la orquestación con `after()` (actions.ts) y la ruta de streaming
// /api/patterns/[id]/standardize (botón con progreso en vivo).

/** Fila de BD → PatternSource (parsea la columna JSON imagePaths). */
export function toSource(row: {
  filePath: string | null;
  externalUrl: string | null;
  imagePaths: string | null;
}): PatternSource {
  return {
    filePath: row.filePath,
    externalUrl: row.externalUrl,
    imagePaths: parseImagePaths(row.imagePaths),
  };
}

/** Datos del patrón origen necesarios para crear hermanos multi-patrón. */
export type SiblingOrigin = {
  title: string;
  autoSplit: boolean;
  filePath: string | null;
  imagePaths: string | null;
  externalUrl: string | null;
  coverImagePath: string | null;
  tags: { name: string }[];
};

export const SIBLING_ORIGIN_SELECT = {
  title: true,
  autoSplit: true,
  filePath: true,
  imagePaths: true,
  externalUrl: true,
  coverImagePath: true,
  tags: { select: { name: true }, orderBy: { name: "asc" as const } },
} as const;

/**
 * Crea los Patterns hermanos para los patrones 2..N detectados en el mismo
 * origen. Los ficheros (PDF, imágenes, portada) se COMPARTEN con el origen:
 * por eso todos los borrados de fichero de patrón pasan por
 * deleteUploadIfUnreferenced, que comprueba si otro patrón los sigue usando.
 */
export async function createPatternSiblings(
  origin: SiblingOrigin,
  patterns: StandardizedPattern[],
): Promise<void> {
  for (let i = 1; i < patterns.length; i++) {
    await prisma.pattern.create({
      data: {
        title: `${origin.title} (${i + 1})`,
        filePath: origin.filePath,
        imagePaths: origin.imagePaths,
        externalUrl: origin.externalUrl,
        coverImagePath: origin.coverImagePath,
        standardizedContent: JSON.stringify(patterns[i]),
        aiStatus: "DONE",
        autoSplit: origin.autoSplit,
        tags: tagsCreateInput(origin.tags.map((tag) => tag.name)),
      },
    });
  }
}

/** Borra un upload solo si ningún OTRO patrón lo sigue referenciando. */
export async function deleteUploadIfUnreferenced(
  path: string | null | undefined,
  exceptPatternId?: string,
): Promise<void> {
  if (!path || !isValidUploadPath(path)) return;
  const stillUsed = await prisma.pattern.count({
    where: {
      ...(exceptPatternId ? { id: { not: exceptPatternId } } : {}),
      OR: [
        { filePath: path },
        { coverImagePath: path },
        { imagePaths: { contains: path } },
      ],
    },
  });
  if (stillUsed === 0) await deleteUpload(path);
}

/**
 * Estandariza el origen del patrón `id` y persiste el resultado:
 * 0 → lanza (el llamador deja ERROR), 1 → DONE con JSON individual,
 * N>1 → autoSplit crea hermanos o MULTIPLE para revisión humana.
 * `onProgress` recibe los eventos del pipeline (para UI en streaming).
 */
export async function standardizeAndSave(
  id: string,
  source: PatternSource,
  origin?: SiblingOrigin,
  onProgress?: (event: SourceProgress) => void,
): Promise<void> {
  // Pipeline completo (texto → visión con reintento por rasterizado). El
  // parsing SIEMPRE lo hace el LLM; nada se extrae a mano.
  const patterns = await standardizePatternSource(source, onProgress);

  if (patterns.length === 0) {
    throw new PatternSourceError("No se detectó ningún patrón en el contenido");
  }
  if (patterns.length === 1) {
    await prisma.pattern.update({
      where: { id },
      data: {
        standardizedContent: JSON.stringify(patterns[0]),
        aiStatus: "DONE",
      },
    });
    return;
  }
  if (origin?.autoSplit) {
    // El origen se queda con el primero; el resto nacen como Patterns nuevos.
    await prisma.pattern.update({
      where: { id },
      data: {
        standardizedContent: JSON.stringify(patterns[0]),
        aiStatus: "DONE",
      },
    });
    await createPatternSiblings(origin, patterns);
    return;
  }
  await prisma.pattern.update({
    where: { id },
    data: {
      standardizedContent: JSON.stringify({ patterns }),
      aiStatus: "MULTIPLE",
    },
  });
}
