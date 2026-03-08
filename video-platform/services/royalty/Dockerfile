# FILE: /video-platform/services/royalty/Dockerfile
# 功能说明：构建分账服务镜像

FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm i --no-audit --no-fund || true
COPY . .
RUN npm run build || true

CMD ["node", "dist/server.js"]