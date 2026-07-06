# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa 1: dependencias
# node:22-slim (glibc) evita fricciones con módulos nativos (better-sqlite3).
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------------------
# Etapa 2: build (genera el cliente Prisma y el servidor standalone)
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# Etapa 3: toolkit de arranque — CLI de Prisma (migrate deploy) + deps del
# seed, autocontenido para no arrastrar el node_modules completo de la app.
# ---------------------------------------------------------------------------
FROM node:22-slim AS migrator
WORKDIR /migrator
RUN npm init -y >/dev/null \
  && npm install --omit=dev --no-audit --no-fund prisma@7 better-sqlite3@12 bcryptjs@3

# ---------------------------------------------------------------------------
# Etapa 4: runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system nodejs && useradd --system --gid nodejs nextjs

# Servidor standalone de Next (con sus node_modules mínimos trazados).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Toolkit de migración/seed: se ejecuta desde /app/migrator en el entrypoint.
COPY --from=migrator --chown=nextjs:nodejs /migrator /app/migrator
COPY --from=builder --chown=nextjs:nodejs /app/prisma /app/migrator/prisma
COPY --chown=nextjs:nodejs docker/prisma.config.mjs /app/migrator/prisma.config.mjs
COPY --chown=nextjs:nodejs docker/seed.cjs /app/migrator/seed.cjs
COPY --chown=nextjs:nodejs docker/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Volúmenes: base de datos SQLite y ficheros subidos.
RUN mkdir -p /app/data /app/uploads && chown -R nextjs:nodejs /app/data /app/uploads
VOLUME ["/app/data", "/app/uploads"]

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
