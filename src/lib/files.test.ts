import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// UPLOAD_ROOT se resuelve al importar el módulo, así que la variable de
// entorno debe fijarse ANTES del import dinámico.
let tmpDir: string;
let files: typeof import("./files");

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "crochety-uploads-"));
  vi.stubEnv("UPLOAD_DIR", tmpDir);
  vi.resetModules();
  files = await import("./files");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(tmpDir, { recursive: true, force: true });
});

describe("resolveUploadPath", () => {
  it("resuelve rutas relativas dentro de la raíz", () => {
    const abs = files.resolveUploadPath("orders/foto.jpg");
    expect(abs).toBe(path.join(tmpDir, "orders", "foto.jpg"));
  });

  it("bloquea path traversal con ../", () => {
    expect(files.resolveUploadPath("../secreto.txt")).toBeNull();
    expect(files.resolveUploadPath("orders/../../etc/passwd")).toBeNull();
  });

  it("bloquea rutas absolutas fuera de la raíz", () => {
    expect(files.resolveUploadPath("/etc/passwd")).toBeNull();
    expect(files.resolveUploadPath("C:\\Windows\\system32")).toBeNull();
  });
});

describe("saveUpload", () => {
  it("guarda una imagen y devuelve una ruta relativa con nombre generado", async () => {
    const file = new File([Buffer.from("fake-png")], "mi foto ../rara.png", {
      type: "image/png",
    });
    const relPath = await files.saveUpload("orders", file);

    // Nombre generado (nunca el original) dentro de la subcarpeta del tipo.
    expect(relPath).toMatch(/^orders\/[0-9a-f-]{36}\.png$/);
    const saved = await readFile(path.join(tmpDir, relPath));
    expect(saved.toString()).toBe("fake-png");
  });

  it("rechaza tipos de fichero no permitidos", async () => {
    const file = new File(["hola"], "script.exe", {
      type: "application/x-msdownload",
    });
    await expect(files.saveUpload("orders", file)).rejects.toThrow(
      files.UploadError,
    );
  });

  it("solo admite documentos (PDF/DOCX) en patrones", async () => {
    const pdf = new File(["%PDF"], "patron.pdf", { type: "application/pdf" });
    await expect(files.saveUpload("materials", pdf)).rejects.toThrow(
      files.UploadError,
    );
    const relPath = await files.saveUpload("patterns", pdf);
    expect(relPath).toMatch(/^patterns\/[0-9a-f-]{36}\.pdf$/);
  });

  it("rechaza imágenes que superan el tamaño máximo", async () => {
    const big = new File(
      [new ArrayBuffer(files.MAX_IMAGE_BYTES + 1)],
      "enorme.png",
      { type: "image/png" },
    );
    await expect(files.saveUpload("orders", big)).rejects.toThrow(
      /demasiado grande/,
    );
  });
});
