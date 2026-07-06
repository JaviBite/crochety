# Despliegue en producción (Vercel)

Arquitectura: **Vercel** (Hobby) para el hosting con deploy automático en cada
push a `master`, **Neon Postgres** (free tier, vía Vercel Marketplace) como base
de datos y **Vercel Blob** para los ficheros subidos. IA con **OpenRouter**
(modelos gratuitos). Coste: 0 €.

> Nota: el plan Hobby de Vercel prohíbe formalmente el uso comercial. Para un
> negocio pequeño el riesgo práctico es bajo; si crece, el plan Pro son 20 $/mes.

## 1. Proyecto en Vercel

1. Cuenta en [vercel.com](https://vercel.com) iniciando sesión **con GitHub**.
2. **Add New → Project** → importar el repo `crochety`. Framework: Next.js
   (autodetectado). No hace falta tocar el build: Vercel usa el script
   `vercel-build` del package.json, que ejecuta `prisma migrate deploy` antes
   de `next build` (las migraciones se aplican solas en cada deploy).
3. No despliegues todavía (faltan BD y variables); si el primer deploy falla,
   no pasa nada — se relanza al acabar la configuración.

## 2. Base de datos (Neon vía Marketplace)

1. En el proyecto → pestaña **Storage** → **Create Database** → **Neon
   (Postgres)** → plan **Free**.
2. Al conectarla al proyecto, Vercel inyecta automáticamente `DATABASE_URL`
   (pooled) y `DATABASE_URL_UNPOOLED` (directa) como variables de entorno.
   El código ya usa la pooled en runtime y la directa para el CLI de Prisma
   (ver `prisma.config.ts`).

## 3. Ficheros (Vercel Blob)

1. Pestaña **Storage** → **Create Database** → **Blob** (1 GB gratis).
2. Al conectarlo, inyecta `BLOB_READ_WRITE_TOKEN`. Nada más que hacer.

## 4. Resto de variables de entorno

En **Settings → Environment Variables** del proyecto añadir:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` (o `npx auth secret`) |
| `AUTH_TRUST_HOST` | `true` |
| `AI_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | key de [openrouter.ai/keys](https://openrouter.ai/keys) |
| `USER1_NAME/EMAIL/PASSWORD` | credenciales del primer usuario (para el seed) |
| `USER2_NAME/EMAIL/PASSWORD` | ídem del segundo |

`AI_MODEL` es opcional: por defecto usa `openrouter/free` (router automático de
modelos gratuitos de OpenRouter).

## 5. Primer deploy

Push a `master` (o **Deployments → Redeploy**). El script `vercel-build` hace
`migrate deploy` + `db seed` + `next build`: migraciones y usuarios (`USER1_*`/
`USER2_*`) se aplican solos en cada deploy (el seed es un upsert idempotente).
Login en `https://<proyecto>.vercel.app/login`.

## 6. Desarrollo local

Ojo: las variables de la integración de Neon/Blob son **Sensitive** en Vercel,
así que `vercel env pull` las descarga VACÍAS. Para el `.env` local:

- `DATABASE_URL` / `DATABASE_URL_UNPOOLED`: cópialas de la consola de Neon
  (Storage → tu BD → **Open in Neon** → Connection string). Mejor aún: crea un
  **branch "dev"** en Neon (free) y usa su URL para no desarrollar contra
  producción. Alternativa sin Neon: `docker run -d -p 5432:5432 -e
  POSTGRES_PASSWORD=dev postgres:17` y
  `DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres`.
- `BLOB_READ_WRITE_TOKEN`: Storage → tu store de Blob → pestaña Settings/
  Tokens, copia el token manualmente.

## 7. Dominio

Por defecto: `https://<proyecto>.vercel.app` (gratis, con SSL). Si algún día hay
dominio propio: Settings → Domains, y Vercel gestiona DNS + certificado.

## Límites del free tier a vigilar

- **Blob 1 GB**: comprimir fotos antes de subirlas alarga mucho la vida.
- **Neon free**: 0,5 GB de datos y la BD "duerme" tras inactividad (el primer
  request tarda ~1 s extra en despertar; irrelevante para 2 usuarias).
- **OpenRouter free**: ~50 peticiones/día (1000 si se cargan 10 $ de crédito
  una única vez).
