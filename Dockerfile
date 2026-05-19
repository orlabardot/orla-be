# =============================================================
# Stage 1: Build — compila TypeScript e gera Prisma Client
# =============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Evita que o puppeteer baixe o Chromium (usaremos o do sistema no runtime)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Gera o Prisma Client
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# =============================================================
# Stage 2: Runtime — imagem enxuta com Chromium instalado
# =============================================================
FROM node:20-slim AS runtime

WORKDIR /app

# Instala Chromium e fontes para o Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Aponta Puppeteer para o Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Copia node_modules (já inclui Prisma Client gerado) e dist compilado
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma/

EXPOSE 3333

# Roda migrations e inicia o servidor
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
