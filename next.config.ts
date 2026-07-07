import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Build autocontenida para la imagen Docker self-hosted (deploy/README.md).
  // Solo el Dockerfile define DOCKER_BUILD: el deploy de Vercel no cambia.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: {
      // Fotos (materiales/pedidos) e imágenes del extractor IA viajan en la
      // action; 4 MB queda bajo el tope de 4,5 MB de las funciones de Vercel.
      // Los ficheros grandes (PDFs de patrones) van aparte por /api/uploads.
      bodySizeLimit: "4mb",
    },
  },
};

export default withNextIntl(nextConfig);
