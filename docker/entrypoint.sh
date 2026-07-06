#!/bin/sh
set -e

echo "▶ Aplicando migraciones de base de datos…"
cd /app/migrator
./node_modules/.bin/prisma migrate deploy

echo "▶ Sembrando usuarios desde variables de entorno…"
node seed.cjs

echo "▶ Arrancando Zgz Stitches en el puerto ${PORT:-3000}…"
cd /app
exec node server.js
