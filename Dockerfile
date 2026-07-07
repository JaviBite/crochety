# Imagen para el despliegue self-hosted con docker compose (deploy/README.md).
# El deploy de Vercel NO usa este fichero.
#
# Etapas:
#   deps    → npm ci (el postinstall genera el cliente de Prisma)
#   builder → next build en modo standalone (DOCKER_BUILD=1)
#   migrate → prisma migrate deploy + db seed (servicio de un solo uso)
#   runner  → servidor Next autocontenido, usuario sin privilegios

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- deps ---------------------------------------------------------------
FROM base AS deps
# prisma/ y prisma.config.ts hacen falta ANTES de npm ci: el postinstall
# ejecuta `prisma generate` (sale en src/generated/prisma).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# --- builder ------------------------------------------------------------
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
# Valores dummy solo para la build (las páginas son dinámicas y no consultan
# la BD al compilar); los reales llegan por entorno en runtime.
ENV DOCKER_BUILD=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="dummy-secret-solo-para-build"
RUN npm run build

# --- migrate ------------------------------------------------------------
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# --- runner -------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads
# El volumen de subidas hereda el propietario de este directorio.
RUN mkdir -p /data/uploads && chown -R node:node /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
