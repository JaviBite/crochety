import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  SIBLING_ORIGIN_SELECT,
  standardizeAndSave,
  toSource,
} from "@/lib/patterns/standardize-persist";
import { PatternSourceError } from "@/lib/pattern-source";
import { prisma } from "@/lib/prisma";
import type { SourceProgress } from "@/lib/ai/standardize-source";

// POST /api/patterns/[id]/standardize — (re)estandariza un patrón guardado
// emitiendo el progreso EN VIVO por streaming (NDJSON: una línea JSON por
// evento). Mismo contrato y pipeline que POST /api/convert: extract →
// text-ready → segmenting → segment i/n → done, más la persistencia del
// resultado (DONE / MULTIPLE / ERROR) sobre la fila del patrón.

export const runtime = "nodejs";

export type StandardizeStreamEvent =
  | SourceProgress
  | { type: "done" }
  | { type: "error"; message: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const pattern = await prisma.pattern.findUnique({
    where: { id },
    select: {
      ...SIBLING_ORIGIN_SELECT,
      coverImagePath: true,
    },
  });
  if (!pattern) {
    return new Response("Patrón no encontrado", { status: 404 });
  }
  const source = toSource(pattern);
  if (!source.filePath && !source.externalUrl && !source.imagePaths?.length) {
    return new Response("El patrón no tiene fichero, imágenes ni enlace", {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StandardizeStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        await prisma.pattern.update({
          where: { id },
          data: { aiStatus: "PROCESSING" },
        });
        await standardizeAndSave(id, source, pattern, send);
        send({ type: "done" });
        revalidatePath("/", "layout");
      } catch (error) {
        await prisma.pattern
          .update({ where: { id }, data: { aiStatus: "ERROR" } })
          .catch(() => {});
        send({
          type: "error",
          message:
            error instanceof PatternSourceError
              ? error.message
              : "La estandarización falló, vuelve a intentarlo",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
