# Nexus Video 部署指南

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm 9+

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发

```bash
npm run dev:services  # 后端
npm run dev:web       # 前端
```

访问 http://localhost:5173

---

## 生产部署

### 前端 (Cloudflare Pages)

```bash
cd client-web && npm run build
# 输出: dist/
```

### 后端 (Docker)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
EXPOSE 3001
CMD ["npm", "run", "start:services"]
```

---

## 环境变量

```env
VITE_API_GATEWAY_URL=http://localhost:3001
VITE_JOYID_APP_URL=https://testnet.joyid.dev
FIBER_RPC_URL=http://18.163.221.211:8227
```