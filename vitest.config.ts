import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
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
