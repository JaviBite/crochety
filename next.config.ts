import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Genera un servidor Node autocontenido (.next/standalone) para Docker.
  output: "standalone",
};

export default withNextIntl(nextConfig);
