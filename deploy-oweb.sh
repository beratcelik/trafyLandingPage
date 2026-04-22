#!/bin/bash
# Trafy Landing — Oweb Sunucusuna Deploy
# Kullanim: ./deploy-oweb.sh
# Gereksinim: sshpass (brew install sshpass)

set -e

SERVER="root@109.104.120.36"
REMOTE_DIR="/root/trafy-landing-v2"
CONTAINER="trafy-landing"
PORT="3000:80"

echo "==> [1/4] GitHub'a push ediliyor..."
git push origin main

echo "==> [2/4] Sunucuda kod guncelleniyor + image build ediliyor..."
sshpass -p 'UqaY6B19m@bviFgO?Xw6' ssh -o StrictHostKeyChecking=no "$SERVER" "
  set -e
  cd $REMOTE_DIR
  git pull origin main
  docker build -t trafy-landing:latest .
  # APK depolama ve imzalama anahtari dizinlerini olustur (yoksa)
  mkdir -p $REMOTE_DIR/app-storage
  mkdir -p $REMOTE_DIR/apk-signing-key
  chmod 700 $REMOTE_DIR/apk-signing-key
"

echo "==> [3/4] Eski container durduruluyor, yeni baslatiliyor..."
sshpass -p 'UqaY6B19m@bviFgO?Xw6' ssh -o StrictHostKeyChecking=no "$SERVER" "
  docker stop $CONTAINER 2>/dev/null || true
  docker rm $CONTAINER 2>/dev/null || true
  docker run -d \
    --name $CONTAINER \
    --restart unless-stopped \
    -p $PORT \
    -e PORT=80 \
    -v $REMOTE_DIR/.env:/app/.env:ro \
    -v $REMOTE_DIR/db:/app/db \
    -v $REMOTE_DIR/app-storage:/app/public/app \
    -v $REMOTE_DIR/apk-signing-key:/etc/trafy:ro \
    trafy-landing:latest
  # Nginx Proxy Manager ile ayni networke bagla (502 onlemek icin)
  docker network connect dmrandevu_dmrandevu-network $CONTAINER 2>/dev/null || true
  sleep 2
  docker logs $CONTAINER --tail 5
"

echo "==> [4/4] Kontrol ediliyor..."
sshpass -p 'UqaY6B19m@bviFgO?Xw6' ssh -o StrictHostKeyChecking=no "$SERVER" \
  "docker ps --filter name=$CONTAINER --format 'STATUS: {{.Status}} | PORT: {{.Ports}}'"

echo ""
echo "Deploy tamamlandi: https://trafy.tr"
