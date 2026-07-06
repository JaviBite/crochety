import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { del, list, put } from "@vercel/blob";
import {
  deleteUpload,
  isValidUploadPath,
  MAX_IMAGE_BYTES,
  readUpload,
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

afterEach(() => {
  vi.unstubAllEnvs();
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

describe("validación de saveUpload (común a ambos drivers)", () => {
  it("rechaza tipos de fichero no permitidos", async () => {
    const file = new File(["hola"], "script.exe", {
      type: "application/x-msdownload",
    });
    await expect(saveUpload("orders", file)).rejects.toThrow(UploadError);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("solo admite documentos (PDF/DOCX) en patrones", async () => {
    const pdf = new File(["%PDF"], "patron.pdf", { type: "application/pdf" });
    await expect(saveUpload("materials", pdf)).rejects.toThrow(UploadError);
  });

  it("rechaza imágenes que superan el tamaño máximo", async () => {
    const big = new File([new ArrayBuffer(MAX_IMAGE_BYTES + 1)], "enorme.png", {
      type: "image/png",
    });
    await expect(saveUpload("orders", big)).rejects.toThrow(/demasiado grande/);
    expect(putMock).not.toHaveBeenCalled();
  });
});

describe("driver Vercel Blob (con BLOB_READ_WRITE_TOKEN)", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
  });

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

  it("resolveUploadUrl devuelve la URL del blob cuando el pathname existe", async () => {
    const relPath = `orders/${UUID}.jpg`;
    listMock.mockResolvedValue({
      blobs: [{ pathname: relPath, url: "https://store.blob/orders/x.jpg" }],
    } as Awaited<ReturnType<typeof list>>);
    await expect(resolveUploadUrl(relPath)).resolves.toBe(
      "https://store.blob/orders/x.jpg",
    );
    expect(listMock).toHaveBeenCalledWith({ prefix: relPath, limit: 1 });
  });

  it("resolveUploadUrl devuelve null si el blob no existe o el path es inválido", async () => {
    listMock.mockResolvedValue({ blobs: [] } as unknown as Awaited<
      ReturnType<typeof list>
    >);
    await expect(resolveUploadUrl(`orders/${UUID}.jpg`)).resolves.toBeNull();
    await expect(resolveUploadUrl("../secreto.txt")).resolves.toBeNull();
  });

  it("deleteUpload borra el blob resuelto por su pathname", async () => {
    const relPath = `orders/${UUID}.jpg`;
    listMock.mockResolvedValue({
      blobs: [{ pathname: relPath, url: "https://store.blob/orders/x.jpg" }],
    } as Awaited<ReturnType<typeof list>>);
    await deleteUpload(relPath);
    expect(delMock).toHaveBeenCalledWith("https://store.blob/orders/x.jpg");
  });

  it("deleteUpload ignora rutas nulas o inexistentes y no propaga errores", async () => {
    await deleteUpload(null);
    await deleteUpload(undefined);
    expect(delMock).not.toHaveBeenCalled();

    listMock.mockRejectedValue(new Error("network down"));
    await expect(deleteUpload(`orders/${UUID}.jpg`)).resolves.toBeUndefined();
  });
});

describe("driver de disco local (sin BLOB_READ_WRITE_TOKEN)", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "crochety-uploads-"));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("UPLOAD_DIR", tmpDir);
  });

  it("guarda en disco y hace el ciclo completo save → read → delete", async () => {
    const file = new File([Buffer.from("fake-png")], "foto.png", {
      type: "image/png",
    });
    const relPath = await saveUpload("orders", file);
    expect(relPath).toMatch(/^orders\/[0-9a-f-]{36}\.png$/);
    expect(putMock).not.toHaveBeenCalled();

    const saved = await readFile(path.join(tmpDir, relPath));
    expect(saved.toString()).toBe("fake-png");

    const content = await readUpload(relPath);
    expect(content).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(content as Uint8Array).toString()).toBe("fake-png");

    await deleteUpload(relPath);
    await expect(readUpload(relPath)).resolves.toBeNull();
    expect(delMock).not.toHaveBeenCalled();
  });

  it("readUpload devuelve null para paths inválidos o ausentes", async () => {
    await expect(readUpload("../secreto.txt")).resolves.toBeNull();
    await expect(readUpload(`orders/${UUID}.jpg`)).resolves.toBeNull();
  });
});
