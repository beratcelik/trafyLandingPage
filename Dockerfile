FROM node:20-bookworm-slim

# apksigner (Android APK Signing Scheme v2/v3 dogrulayici) ve Java runtime
# Debian bookworm reposunda apksigner mevcuttur ve apksigner-jar + bash wrapper'i kurar
RUN apt-get update \
    && apt-get install -y --no-install-recommends apksigner default-jre-headless ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

# DB ve APK dizinlerini ihtiyaten olustur (volume mount edilirse uzerine yazilir)
RUN mkdir -p db public/app

EXPOSE 80

CMD ["node", "server.js"]
