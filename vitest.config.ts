import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // El paquete `server-only` lanza fuera de React Server Components; en tests
  // (node/jsdom) se sustituye por su entrada vacía para poder probar los
  // módulos de servidor.
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  // esbuild transforma el JSX automáticamente (runtime "automatic"): no hace
  // falta @vitejs/plugin-react solo para tests.
  esbuild: { jsx: "automatic" },
  test: {
    // Por defecto node; los tests de componentes declaran jsdom con el
    // docblock `// @vitest-environment jsdom` en la cabecera del fichero.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
