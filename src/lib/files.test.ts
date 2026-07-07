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
import { del, get, put } from "@vercel/blob";
import {
  deleteUpload,
  isValidUploadPath,
  MAX_IMAGE_BYTES,
  readUpload,
  saveUpload,
  UploadError,
} from "./files";

// Sin red en tests: se mockea el SDK de Vercel Blob entero.
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
}));

const putMock = vi.mocked(put);
const delMock = vi.mocked(del);
const getMock = vi.mocked(get);

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

  it("readUpload devuelve el stream del blob por su pathname", async () => {
    const relPath = `orders/${UUID}.jpg`;
    const stream = new ReadableStream<Uint8Array>();
    getMock.mockResolvedValue({ statusCode: 200, stream } as Awaited<
      ReturnType<typeof get>
    >);
    await expect(readUpload(relPath)).resolves.toBe(stream);
    expect(getMock).toHaveBeenCalledWith(
      relPath,
      expect.objectContaining({ access: expect.any(String) }),
    );
  });

  it("readUpload devuelve null si el blob no existe o el path es inválido", async () => {
    getMock.mockResolvedValue(null);
    await expect(readUpload(`orders/${UUID}.jpg`)).resolves.toBeNull();
    await expect(readUpload("../secreto.txt")).resolves.toBeNull();
  });

  it("deleteUpload borra el blob por su pathname (idempotente)", async () => {
    const relPath = `orders/${UUID}.jpg`;
    await deleteUpload(relPath);
    expect(delMock).toHaveBeenCalledWith(relPath);
  });

  it("deleteUpload ignora rutas nulas o inexistentes y no propaga errores", async () => {
    await deleteUpload(null);
    await deleteUpload(undefined);
    expect(delMock).not.toHaveBeenCalled();

    delMock.mockRejectedValue(new Error("network down"));
    await expect(deleteUpload(`orders/${UUID}.jpg`)).resolves.toBeUndefined();
  });

  // Este test cambia el modo memorizado a "private": va el último del bloque.
  it("saveUpload reintenta con access private cuando el store es privado", async () => {
    putMock.mockRejectedValueOnce(
      new Error(
        "Vercel Blob: Cannot use public access on a private store. The store is configured with private access.",
      ),
    );
    putMock.mockResolvedValueOnce({} as Awaited<ReturnType<typeof put>>);

    const file = new File([Buffer.from("fake-png")], "foto.png", {
      type: "image/png",
    });
    const relPath = await saveUpload("orders", file);

    expect(putMock).toHaveBeenCalledTimes(2);
    expect(putMock).toHaveBeenNthCalledWith(
      1,
      relPath,
      file,
      expect.objectContaining({ access: "public" }),
    );
    expect(putMock).toHaveBeenNthCalledWith(
      2,
      relPath,
      file,
      expect.objectContaining({ access: "private" }),
    );
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
