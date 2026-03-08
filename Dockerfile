# 多阶段构建 Dockerfile - 后端服务
# FILE: /video-platform/Dockerfile
#
# 使用方法:
#   docker build --build-arg SERVICE=identity -t video-platform/identity .
#   docker build --build-arg SERVICE=payment -t video-platform/payment .
#
# 此 Dockerfile 与 deploy/docker/Dockerfile.service 功能等价，
# 方便从项目根目录直接构建。

# ============== Stage 1: 基础 ==============
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

# ============== Stage 2: 安装依赖 ==============
FROM base AS deps
# 复制 monorepo 根配置
COPY package.json package-lock.json ./
# 复制各 workspace 的 package.json（保持目录结构）
COPY shared/package.json ./shared/
COPY packages/database/package.json ./packages/database/
# 各服务的 package.json
COPY services/identity/package.json ./services/identity/
COPY services/payment/package.json ./services/payment/
COPY services/content/package.json ./services/content/
COPY services/metadata/package.json ./services/metadata/
COPY services/royalty/package.json ./services/royalty/
COPY services/nft/package.json ./services/nft/
COPY services/live/package.json ./services/live/
COPY services/achievement/package.json ./services/achievement/
COPY services/governance/package.json ./services/governance/
COPY services/bridge/package.json ./services/bridge/
COPY services/transcode/package.json ./services/transcode/
COPY services/search/package.json ./services/search/
COPY services/moderation/package.json ./services/moderation/
COPY services/messaging/package.json ./services/messaging/
COPY services/engagement/package.json ./services/engagement/
# 安装所有依赖（含 devDependencies 用于 tsc 编译）
RUN npm ci

# ============== Stage 3: 构建 ==============
FROM base AS builder
ARG SERVICE=identity
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
# 复制源代码
COPY . .
# 生成 Prisma Client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
# TypeScript 编译目标服务
RUN npm run build -w services/${SERVICE}

# ============== Stage 4: 运行 ==============
FROM node:20-alpine AS runner
WORKDIR /app

# 安全设置
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

ENV NODE_ENV=production

ARG SERVICE=identity
ENV SERVICE_NAME=${SERVICE}

# 复制编译产物与运行依赖
COPY --from=builder --chown=appuser:nodejs /app/services/${SERVICE}/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=appuser:nodejs /app/shared ./shared
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

EXPOSE ${PORT:-8080}
CMD ["node", "dist/server.js"]
