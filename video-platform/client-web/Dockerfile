# 前端 Dockerfile
# FILE: /video-platform/client-web/Dockerfile
#
# 使用方法:
#   docker build -t video-platform/web ./client-web

# ============== Stage 1: Build ==============
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 环境变量 (构建时注入)
ARG VITE_API_URL=https://api.example.com
ARG VITE_PAYMENT_URL=https://api.example.com
ARG VITE_WS_URL=wss://ws.example.com
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PAYMENT_URL=${VITE_PAYMENT_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# 构建
RUN npm run build

# ============== Stage 2: Serve ==============
FROM nginx:alpine AS runner

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
