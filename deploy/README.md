# Despliegue en producción (Oracle Cloud Always Free)

Arquitectura: VM ARM Always Free de Oracle con `docker compose` (app + Caddy),
imagen construida por GitHub Actions en ghcr.io y desplegada por SSH en cada
push a `master`. Dominio gratuito de DuckDNS con HTTPS automático (Let's
Encrypt vía Caddy). IA con OpenRouter (modelos gratuitos). Coste: 0 €.

## 1. Crear la VM en Oracle Cloud

1. Cuenta en [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
   (pide tarjeta para verificar, pero el Always Free no cobra).
2. Compute → Instances → Create: shape **VM.Standard.A1.Flex** (p. ej.
   2 OCPU / 12 GB, dentro del límite Always Free de 4 OCPU / 24 GB), imagen
   **Ubuntu 24.04 (aarch64)**, y sube tu clave SSH pública.
   - Si da "Out of capacity": prueba otro Availability Domain u otra hora;
     es la pega habitual del free tier.
3. Networking → reservar una **IP pública estática** (gratis) y asignarla a
   la VNIC de la instancia.
4. Abrir puertos **80 y 443**, en los DOS sitios:
   - VCN → Security List → Ingress Rules: TCP 80 y 443 desde `0.0.0.0/0`.
   - Dentro de la VM (las imágenes de Oracle traen iptables restrictivo):
     ```bash
     sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```

## 2. Preparar la VM

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # re-loguearse después

# La app vive en ~/crochety (clon del repo: el compose y el Caddyfile van por git)
git clone https://github.com/JaviBite/crochety.git ~/crochety
cd ~/crochety
cp .env.example .env && nano .env
```

`.env` de producción — rellenar al menos:

- `AUTH_SECRET` nuevo (`openssl rand -base64 32`)
- `USER1_*` / `USER2_*` (credenciales reales del seed)
- `AI_PROVIDER="openrouter"` + `OPENROUTER_API_KEY` (key en
  [openrouter.ai/keys](https://openrouter.ai/keys); `AI_MODEL` por defecto usa
  el router gratuito `openrouter/free`)
- `DOMAIN` (paso 3)

`DATABASE_URL` y `UPLOAD_DIR` los sobreescribe el compose; los datos quedan en
`~/crochety/data` y `~/crochety/uploads` (volúmenes bind).

## 3. Dominio gratuito (DuckDNS)

1. En [duckdns.org](https://www.duckdns.org): crear subdominio (p. ej.
   `zgzstitches`) apuntando a la IP reservada de la VM. Al ser IP estática no
   hace falta cron de refresco.
2. En `.env`: `DOMAIN="zgzstitches.duckdns.org"`.

## 4. CI/CD con GitHub Actions

El workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
construye la imagen `linux/arm64`, la publica en `ghcr.io/javibite/crochety` y
despliega por SSH. Configuración una sola vez:

1. Clave SSH dedicada para el deploy:
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N ""
   # la pública → ~/.ssh/authorized_keys de la VM
   # la privada → secret DEPLOY_SSH_KEY
   ```
2. Secrets del repo (Settings → Secrets and variables → Actions):
   `DEPLOY_HOST` (IP de la VM), `DEPLOY_USER` (`ubuntu`), `DEPLOY_SSH_KEY`.
3. Si el paquete de ghcr es privado, en la VM: `docker login ghcr.io` con un
   token clásico con scope `read:packages`. (Alternativa: hacer público el
   paquete en la página del package de GitHub.)
4. Push a `master` → build + deploy. Primer arranque:
   `docker compose -f docker-compose.prod.yml up -d` a mano si no quieres
   esperar al workflow.

El entrypoint del contenedor ya ejecuta `migrate deploy` + seed en cada
arranque, así que las migraciones nuevas se aplican solas.

## 5. Backup mínimo

Cron diario en la VM (`crontab -e`):

```cron
0 4 * * * cd ~/crochety && mkdir -p ~/backups && sqlite3 data/crochety.db ".backup '$HOME/backups/crochety-$(date +\%u).db'" && tar czf ~/backups/uploads-$(date +\%u).tar.gz uploads
```

(`%u` = día de la semana → rotación de 7 días. Requiere `sudo apt install sqlite3`.)
Opcional futuro: `rclone` de `~/backups` a un almacenamiento gratuito externo.

## Notas

- La imagen es **arm64**: si algún día se cambia a una VM x86, ajustar
  `platforms:` en el workflow.
- OpenRouter free tier: ~50 peticiones/día (1000 si alguna vez cargas 10 $ de
  crédito una única vez) — de sobra para estandarizar patrones.
