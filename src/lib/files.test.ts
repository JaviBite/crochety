import { beforeEach, describe, expect, it, vi } from "vitest";
import { del, list, put } from "@vercel/blob";
import {
  deleteUpload,
  isValidUploadPath,
  MAX_IMAGE_BYTES,
  resolveUploadUrl,
  saveUpload,
  UploadError,
} from "./files";

// Sin red en tests: se mockea el SDK de Vercel Blob entero.
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
}));

const putMock = vi.mocked(put);
const delMock = vi.mocked(del);
const listMock = vi.mocked(list);

const UUID = "123e4567-e89b-42d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  putMock.mockResolvedValue({
    url: "https://store.blob/x",
    pathname: "x",
  } as Awaited<ReturnType<typeof put>>);
});

describe("isValidUploadPath", () => {
  it("acepta pathnames con la forma generada por saveUpload", () => {
    expect(isValidUploadPath(`orders/${UUID}.jpg`)).toBe(true);
    expect(isValidUploadPath(`patterns/${UUID}.pdf`)).toBe(true);
  });

  it("bloquea path traversal y rutas absolutas", () => {
    expect(isValidUploadPath("../secreto.txt")).toBe(false);
    expect(isValidUploadPath(`orders/../../etc/${UUID}.jpg`)).toBe(false);
    expect(isValidUploadPath("/etc/passwd")).toBe(false);
    expect(isValidUploadPath("C:\\Windows\\system32")).toBe(false);
  });

  it("bloquea tipos, extensiones y nombres no generados", () => {
    expect(isValidUploadPath(`otros/${UUID}.jpg`)).toBe(false);
    expect(isValidUploadPath(`orders/${UUID}.exe`)).toBe(false);
    expect(isValidUploadPath("orders/foto-original.jpg")).toBe(false);
  });
});

describe("saveUpload", () => {
  it("sube una imagen y devuelve un pathname relativo con nombre generado", async () => {
    const file = new File([Buffer.from("fake-png")], "mi foto ../rara.png", {
      type: "image/png",
    });
    const relPath = await saveUpload("orders", file);

    // Nombre generado (nunca el original) dentro de la subcarpeta del tipo.
    expect(relPath).toMatch(/^orders\/[0-9a-f-]{36}\.png$/);
    expect(putMock).toHaveBeenCalledWith(
      relPath,
      file,
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
      }),
    );
  });

  it("rechaza tipos de fichero no permitidos sin llamar a Blob", async () => {
    const file = new File(["hola"], "script.exe", {
      type: "application/x-msdownload",
    });
    await expect(saveUpload("orders", file)).rejects.toThrow(UploadError);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("solo admite documentos (PDF/DOCX) en patrones", async () => {
    const pdf = new File(["%PDF"], "patron.pdf", { type: "application/pdf" });
    await expect(saveUpload("materials", pdf)).rejects.toThrow(UploadError);
    const relPath = await saveUpload("patterns", pdf);
    expect(relPath).toMatch(/^patterns\/[0-9a-f-]{36}\.pdf$/);
  });

  it("rechaza imágenes que superan el tamaño máximo", async () => {
    const big = new File([new ArrayBuffer(MAX_IMAGE_BYTES + 1)], "enorme.png", {
      type: "image/png",
    });
    await expect(saveUpload("orders", big)).rejects.toThrow(/demasiado grande/);
    expect(putMock).not.toHaveBeenCalled();
  });
});

describe("resolveUploadUrl", () => {
  const relPath = `orders/${UUID}.jpg`;

  it("devuelve la URL del blob cuando el pathname existe", async () => {
    listMock.mockResolvedValue({
      blobs: [{ pathname: relPath, url: "https://store.blob/orders/x.jpg" }],
    } as Awaited<ReturnType<typeof list>>);
    await expect(resolveUploadUrl(relPath)).resolves.toBe(
      "https://store.blob/orders/x.jpg",
    );
    expect(listMock).toHaveBeenCalledWith({ prefix: relPath, limit: 1 });
  });

  it("devuelve null si el blob no existe", async () => {
    listMock.mockResolvedValue({ blobs: [] } as unknown as Awaited<
      ReturnType<typeof list>
    >);
    await expect(resolveUploadUrl(relPath)).resolves.toBeNull();
  });

  it("rechaza pathnames inválidos sin llamar a Blob", async () => {
    await expect(resolveUploadUrl("../secreto.txt")).resolves.toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("deleteUpload", () => {
  const relPath = `orders/${UUID}.jpg`;

  it("borra el blob resuelto por su pathname", async () => {
    listMock.mockResolvedValue({
      blobs: [{ pathname: relPath, url: "https://store.blob/orders/x.jpg" }],
    } as Awaited<ReturnType<typeof list>>);
    await deleteUpload(relPath);
    expect(delMock).toHaveBeenCalledWith("https://store.blob/orders/x.jpg");
  });

  it("ignora rutas nulas o inexistentes", async () => {
    await deleteUpload(null);
    await deleteUpload(undefined);
    listMock.mockResolvedValue({ blobs: [] } as unknown as Awaited<
      ReturnType<typeof list>
    >);
    await deleteUpload(relPath);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("es best-effort: no propaga errores del SDK", async () => {
    listMock.mockRejectedValue(new Error("network down"));
    await expect(deleteUpload(relPath)).resolves.toBeUndefined();
  });
});
