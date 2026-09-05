import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import {
  DOCUMENT_MIME_TO_EXT,
  IMAGE_MIME_TO_EXT,
  isUploadKind,
  isValidUploadPath,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  type UploadKind,
} from "@/lib/files";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });
  return new Response(null, {
    status: process.env.BLOB_READ_WRITE_TOKEN ? 204 : 503,
  });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Subida directa no disponible", { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return new Response("Petición inválida", { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let kind: UploadKind | null = null;
        let mime = "";
        try {
          const payload = JSON.parse(clientPayload ?? "{}");
          if (typeof payload.kind === "string" && isUploadKind(payload.kind)) {
            kind = payload.kind;
          }
          if (typeof payload.mime === "string") mime = payload.mime;
        } catch {
          // Invalid payloads are rejected below.
        }

        const isImage = mime in IMAGE_MIME_TO_EXT;
        const isDocument = mime in DOCUMENT_MIME_TO_EXT;
        const expectedExt = isImage
          ? IMAGE_MIME_TO_EXT[mime]
          : DOCUMENT_MIME_TO_EXT[mime];
        if (
          !kind ||
          !expectedExt ||
          !isValidUploadPath(pathname) ||
          !pathname.startsWith(`${kind}/`) ||
          (isDocument && kind !== "patterns")
        ) {
          throw new Error("Ruta o tipo de fichero inválido");
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: isImage ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES,
          addRandomSuffix: false,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return Response.json(result);
  } catch {
    return new Response("No se pudo autorizar la subida", { status: 400 });
  }
}
