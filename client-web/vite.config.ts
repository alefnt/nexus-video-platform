// FILE: /video-platform/client-web/vite.config.ts
/**
 * 功能说明：
 * - Vite 配置，支持 React 18 + TypeScript。
 * - 注入 API 网关环境变量。
 *
 * 环境变量：
 * - VITE_API_GATEWAY_URL
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
// Force restart 3




export default defineConfig({
  plugins: [
    react(),
    !!process.env.ANALYZE && visualizer({ open: true, filename: "dist/stats.html", gzipSize: true }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:jpg|jpeg|png|webp|svg)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\./i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "cdn-media-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Nexus",
        short_name: "Nexus",
        description: "Decentralized Video Streaming & Creator Platform",
        theme_color: "#0A0A10",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "https://api.iconify.design/ri:movie-2-fill.svg?color=%2300f5d4&width=192&height=192",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "https://api.iconify.design/ri:movie-2-fill.svg?color=%2300f5d4&width=512&height=512",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  // 启用 SPA 回退，将所有未命中文件路径回退到 index.html
  appType: "spa",
  server: {
    port: 5173,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    // 修复 Node.js 全局变量
    global: 'globalThis',
  },
  // 生产构建配置
  build: {
    rollupOptions: {
      // 外部化 Node.js 模块 (不应在浏览器中使用)
      output: {
        manualChunks(id: string) {
          // React core — loaded everywhere, cache separately
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-router';
          // Large media libs
          if (id.includes("video.js") || id.includes("videojs")) return "vendor-videojs";
          if (id.includes("hls.js")) return "vendor-hls";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("three") || id.includes("@react-three") || id.includes("drei")) return "vendor-three";
          if (id.includes("livekit")) return "vendor-livekit";
          // Web3 / CKB libs
          if (id.includes('@ckb-ccc') || id.includes('@ckb-lumos') || id.includes('rgbpp')) return 'vendor-ckb';
          // Query / state management
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          // Utility libs
          if (id.includes('lucide-react')) return 'vendor-icons';
        },
      },
      external: [
        'node:fs',
        'node:path',
        'node:crypto',
        'node:buffer',
        'node:stream',
        'node:util',
        'node:url',
        'node:http',
        'node:https',
        'node:zlib',
        'node:os',
        'node:net',
        'node:tls',
        'node:child_process',
        'fs',
        'path',
        'crypto',
        'stream',
        'http',
        'https',
        'zlib',
        'os',
        'net',
        'tls',
      ],
    },
    // 提高 chunk 警告阈值
    chunkSizeWarningLimit: 2000,
    // 源码映射 (生产环境可关闭)
    sourcemap: false,
  },
  // 优化依赖处理
  optimizeDeps: {
    esbuildOptions: {
      // 定义 Node.js 全局变量
      define: {
        global: 'globalThis',
      },
    },
    // 排除有问题的依赖
    exclude: ['@ckb-lumos/lumos'],
    // 强制预构建依赖，解决 504 Outdated Optimize Dep 问题
    include: ['framer-motion', 'lucide-react', 'react-dom/client'],
  },
  // 解析配置 (已通过 rollup external 处理，无需别名)
  // resolve: {
  //   alias: {
  //     stream: 'stream-browserify',
  //     crypto: 'crypto-browserify',
  //     buffer: 'buffer',
  //   },
  // },
});