import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.$transaction,
  },
}));

type Row = { key: string; value: string };

// El módulo memoiza la lectura de BD (React cache): se recarga en cada test
// para partir de un estado limpio.
async function loadSettings(rows: Row[] = []) {
  vi.resetModules();
  mocks.findMany.mockResolvedValue(rows);
  return await import("./settings");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getSetting", () => {
  it("prefiere el valor de la BD sobre la variable de entorno", async () => {
    vi.stubEnv("AI_MODEL", "modelo-env");
    const settings = await loadSettings([
      { key: "aiModel", value: "modelo-bd" },
    ]);
    expect(await settings.getSetting("aiModel")).toBe("modelo-bd");
  });

  it("cae a la variable de entorno si no hay fila en BD", async () => {
    vi.stubEnv("AI_MODEL", "modelo-env");
    const settings = await loadSettings();
    expect(await settings.getSetting("aiModel")).toBe("modelo-env");
  });

  it("devuelve null sin fila ni variable de entorno", async () => {
    vi.stubEnv("AI_MODEL", "");
    const settings = await loadSettings();
    expect(await settings.getSetting("aiModel")).toBeNull();
  });

  it("ignora filas con valor en blanco (equivalen a sin ajuste)", async () => {
    vi.stubEnv("AI_MODEL", "modelo-env");
    const settings = await loadSettings([{ key: "aiModel", value: "   " }]);
    expect(await settings.getSetting("aiModel")).toBe("modelo-env");
  });
});

describe("resolveAiProvider", () => {
  it("usa anthropic por defecto", async () => {
    const settings = await loadSettings();
    expect(settings.resolveAiProvider(null)).toBe("anthropic");
  });

  it("rechaza proveedores desconocidos", async () => {
    const settings = await loadSettings();
    expect(() => settings.resolveAiProvider("gemini")).toThrow(
      /Proveedor de IA inválido/,
    );
  });
});

describe("getAiConfig", () => {
  it("resuelve la clave API del proveedor elegido con fallback a env", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-env");
    const settings = await loadSettings([
      { key: "aiProvider", value: "openrouter" },
      { key: "aiModel", value: "nvidia/nemotron-3-super-120b-a12b:free" },
    ]);
    expect(await settings.getAiConfig()).toEqual({
      provider: "openrouter",
      modelId: "nvidia/nemotron-3-super-120b-a12b:free",
      apiKey: "sk-or-env",
      ollamaBaseUrl: null,
    });
  });

  it("ollama no necesita clave API", async () => {
    const settings = await loadSettings([
      { key: "aiProvider", value: "ollama" },
    ]);
    const config = await settings.getAiConfig();
    expect(config.provider).toBe("ollama");
    expect(config.apiKey).toBeNull();
  });
});

describe("getWorkshopSettings", () => {
  it("aplica los valores por defecto del taller", async () => {
    const settings = await loadSettings();
    expect(await settings.getWorkshopSettings()).toEqual({
      name: "Zgz Stitches",
      tagline: null,
      galleryEnabled: true,
    });
  });

  it("lee nombre, tagline y galería de la BD", async () => {
    const settings = await loadSettings([
      { key: "workshopName", value: "Taller Lanero" },
      { key: "workshopTagline", value: "Puntadas con cariño" },
      { key: "galleryEnabled", value: "false" },
    ]);
    expect(await settings.getWorkshopSettings()).toEqual({
      name: "Taller Lanero",
      tagline: "Puntadas con cariño",
      galleryEnabled: false,
    });
  });
});

describe("getDefaultAccent", () => {
  it("valida el acento guardado y cae a mint si no es válido", async () => {
    const lavender = await loadSettings([
      { key: "defaultAccent", value: "lavender" },
    ]);
    expect(await lavender.getDefaultAccent()).toBe("lavender");

    const invalid = await loadSettings([
      { key: "defaultAccent", value: "fucsia" },
    ]);
    expect(await invalid.getDefaultAccent()).toBe("mint");
  });
});

describe("saveSettings", () => {
  it("upsertea valores y borra las claves vacías o null", async () => {
    const settings = await loadSettings();
    await settings.saveSettings({
      workshopName: "Taller Lanero",
      workshopTagline: "",
      aiModel: null,
    });

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "workshopName" },
      update: { value: "Taller Lanero" },
      create: { key: "workshopName", value: "Taller Lanero" },
    });
    expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { key: "workshopTagline" },
    });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
  });

  it("no abre transacción sin entradas", async () => {
    const settings = await loadSettings();
    await settings.saveSettings({});
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });
});
