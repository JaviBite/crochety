# Despliegue

Dos opciones: **A) Vercel** (la usada en producción, gratis) y
**B) self-hosted con Docker Compose** (un solo comando, para servidor propio).

# Opción A — Vercel

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

## 6. Desarrollo local (offline)

El dev local no necesita ningún servicio de Vercel:

- **BD**: Postgres local en Docker —
  `docker run --name crochety-pg -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:17`
  y en `.env`: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres`.
  Después `npm run db:migrate` + `npm run db:seed` (una vez).
- **Uploads**: con `BLOB_READ_WRITE_TOKEN` vacío, `lib/files.ts` guarda en
  `./uploads` (driver de disco). No hay que configurar nada.

Si algún día se quiere desarrollar contra datos reales: las variables de la
integración Neon/Blob son **Sensitive** en Vercel y `vercel env pull` las
descarga VACÍAS — hay que copiar la connection string desde la consola de Neon
(Storage → **Open in Neon**; mejor desde un branch "dev") y el token de Blob
desde su pestaña de settings.

## 7. Dominio

Por defecto: `https://<proyecto>.vercel.app` (gratis, con SSL). Si algún día hay
dominio propio: Settings → Domains, y Vercel gestiona DNS + certificado.

## Límites del free tier a vigilar

- **Blob 1 GB**: comprimir fotos antes de subirlas alarga mucho la vida.
- **Neon free**: 0,5 GB de datos y la BD "duerme" tras inactividad (el primer
  request tarda ~1 s extra en despertar; irrelevante para 2 usuarias).
- **OpenRouter free**: ~50 peticiones/día (1000 si se cargan 10 $ de crédito
  una única vez).

# Opción B — Self-hosted con Docker Compose

Todo en un solo `docker compose`: la app (build standalone de Next), un
Postgres 17 con su volumen, y un servicio `migrate` de un solo uso que aplica
las migraciones y siembra los usuarios en cada arranque (idempotente, igual
que hace `vercel-build`). Los ficheros subidos van a un volumen docker con el
driver de disco de `lib/files.ts` — no hace falta Vercel Blob ni Neon.

## 1. Configuración

```bash
cp deploy/selfhosted.env.example deploy/selfhosted.env
# editar deploy/selfhosted.env: contraseña de BD (¡aparece 2 veces!),
# AUTH_SECRET, usuarios y proveedor de IA
```

`deploy/selfhosted.env` está en `.gitignore`: nunca se sube al repo.

## 2. Arrancar

```bash
docker compose up -d --build
```

La primera build tarda unos minutos (npm ci + next build dentro de la imagen).
Cuando `migrate` termina, la app queda en `http://<servidor>:3000` (login en
`/login` con los usuarios del env). Tras un `git pull`, repetir el mismo
comando: reconstruye, migra y reinicia.

## 3. Datos y copias de seguridad

- BD: volumen `crochety_db-data`. Backup:
  `docker compose exec db pg_dump -U crochety crochety > backup.sql`
- Ficheros subidos: volumen `crochety_uploads`.

## 4. TLS / dominio (fuera del compose)

El compose expone HTTP plano en el puerto 3000. Para exponerlo a internet,
poner delante cualquier reverse proxy con certificados (Caddy, Traefik,
nginx + certbot) apuntando a `localhost:3000`. En LAN no hace falta nada.

## Notas

- La IA es igual que en Vercel (por env). Para no depender de nadie:
  `AI_PROVIDER=ollama` y añadir un servicio `ollama` al compose (o usar uno ya
  existente en la máquina vía `OLLAMA_BASE_URL`).
- El deploy de Vercel no se ve afectado: el modo standalone de Next solo se
  activa con `DOCKER_BUILD=1`, que únicamente define el `Dockerfile`.
