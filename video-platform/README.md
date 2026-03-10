<p align="center">
  <img src="docs/images/logo.svg" alt="Nexus Logo" width="80" />
</p>

<h1 align="center">⚡ Nexus Video Platform</h1>

<p align="center">
  <strong>Decentralized Content Platform Powered by CKB Blockchain</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#web3-integration">Web3</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Fastify-4-000000?logo=fastify&logoColor=white" />
  <img src="https://img.shields.io/badge/CKB-Testnet-00CC96?logo=data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 📸 Screenshots

<p align="center">
  <img src="docs/images/homepage.png" alt="Homepage" width="800" />
  <br/>
  <em>Homepage — Discover cinematic videos, music, articles, and live streams with per-second micropayments</em>
</p>

<p align="center">
  <img src="docs/images/login.png" alt="Login" width="600" />
  <br/>
  <em>Web3 Login — JoyID Passkey, MetaMask, WalletConnect, Nostr, and traditional email</em>
</p>

---

## 🎯 What is Nexus?

**Nexus** is a full-stack **decentralized content platform** that combines the user experience of platforms like YouTube and Spotify with the ownership and payment infrastructure of Web3. Built on the **CKB (Nervos Network)** blockchain, Nexus enables:

- 🎬 **Per-second streaming payments** — Pay only for what you watch, billed per second via Fiber Network L2
- 🎵 **Multi-format content** — Videos, music, articles, and live streams in one unified platform
- 🔐 **True content ownership** — Every piece of content becomes an on-chain NFT via Spore Protocol
- 💰 **Automated revenue splits** — RGB++ isomorphic binding enables trustless multi-party royalty distribution
- 🆔 **Non-custodial identity** — JoyID Passkey login with no seed phrases required

---

## ✨ Features

### 🎬 Content & Media
| Feature | Description |
|---------|-------------|
| **Video Streaming** | HLS adaptive playback with DRM ticket protection and per-second billing |
| **Music Player** | Full audio player with playlist management across streaming and purchased content |
| **Article Editor** | Rich text article creation with Markdown support and on-chain publishing |
| **Live Streaming** | Real-time broadcasting via LiveKit with chat, danmaku (bullet comments), and gifting |
| **Watch Party** | Synchronized co-watching with 3D virtual rooms, avatars, and real-time chat |

### 💳 Payments & Economy
| Feature | Description |
|---------|-------------|
| **Per-Second Billing** | Fiber Network L2 micropayments — no more subscriptions, pay only for what you consume |
| **Points System** | Platform currency with top-up (1 USDI = 100 PTS, 1 CKB = 10,000 PTS) |
| **Tipping & Gifts** | 10 gift types (❤️ to 🚀) with visual effects and tip leaderboards |
| **Creator Revenue** | Automated royalty splits via RGB++ smart contracts |
| **Daily Rewards** | Check-in system with multiplier bonuses (up to 7x) and daily quests |

### 🎨 NFT & Web3
| Feature | Description |
|---------|-------------|
| **Content NFTs** | 7 NFT categories via Spore Protocol: Ownership, Access Pass, Limited Edition, Creator Badge, and more |
| **NFT Marketplace** | Browse, buy, and sell content NFTs with on-chain provenance |
| **Fragment Gallery** | Visual NFT collection showcase |
| **Achievement SBTs** | 18 non-transferable Soulbound Tokens across 5 categories |
| **DAO Governance** | Token-based proposals and voting (quorum 10k, threshold 50-67%) |

### 🤖 AI Studio
| Feature | Description |
|---------|-------------|
| **AI Article Lab** | AI-powered article generation with multiple LLM providers (OpenAI, DeepSeek, Ollama) |
| **AI Music Lab** | Music generation via Suno API with real-time progress and local storage |
| **AI Video Lab** | Video generation via Runway, Kling AI, and other providers |
| **AI Settings** | BYOK (Bring Your Own Key) with AES-256 encryption and per-provider config |
| **AI Tool Marketplace** | Decentralized marketplace for AI tools with Spore NFT ownership + Fiber payments + RGB++ splits |
| **AI Tool Submission** | 3-step creator wizard for publishing AI tools with pricing and NFT minting |

### 👤 Social & Engagement
| Feature | Description |
|---------|-------------|
| **Creator Studio** | Dashboard with analytics, content management, and upload tools |
| **Channel Pages** | Customizable creator profiles with follower system |
| **Comments & Danmaku** | Nested comment threads and real-time bullet comments (弹幕) via SSE |
| **Messages** | WebSocket-based direct messaging with push notifications |
| **Search** | Full-text search powered by MeiliSearch |
| **Live PK Battles** | 60-second scored competition mode between streamers |
| **Cross-Platform OAuth** | Real OAuth 2.0 + PKCE for TikTok, YouTube, Bilibili, Twitter, Google |

---

## 🏗️ Architecture

Nexus follows a **microservices architecture** with 17 Fastify-based backend services, a React SPA frontend, and Docker-managed infrastructure.

```
┌──────────────────────────────────────────────────────────────┐
│                     Client (React + Vite)                     │
│               http://localhost:5173                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Identity / API Gateway (:8080)                   │
│         JWT Auth · Route Proxy · Circuit Breaker              │
└─────┬────────┬────────┬────────┬────────┬────────┬───────────┘
      │        │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼        ▼
  ┌───────┐┌───────┐┌───────┐┌───────┐┌───────┐┌───────┐
  │Payment││Content││Meta-  ││Royalty││ NFT   ││ Live  │
  │ :8091 ││ :8092 ││ data  ││ :8094 ││ :8095 ││ :8096 │
  │       ││       ││ :8093 ││       ││       ││       │
  └───────┘└───────┘└───────┘└───────┘└───────┘└───────┘
      │        │        │
      ▼        ▼        ▼
  ┌─────────────────────────────────────────┐
  │         Infrastructure (Docker)          │
  │  PostgreSQL · Redis · MinIO · MeiliSearch│
  └─────────────────────────────────────────┘
```

### Microservices

| Port | Service | Responsibility |
|------|---------|----------------|
| **8080** | **Identity/Gateway** | JWT auth, route proxying, circuit breaking, JoyID/MetaMask/Email/TikTok/YouTube/Bilibili login |
| **8091** | **Payment** | Points balance, CKB/USDI top-up, per-second stream billing, Fiber invoice clearing |
| **8092** | **Content** | Upload (Base64/TUS), HybridStorageEngine, DRM/HLS ticket generation |
| **8093** | **Metadata** | Video/music/article metadata, danmaku (SSE), comments, trending, watchlists |
| **8094** | **Royalty** | RGB++ isomorphic binding revenue split execution |
| **8095** | **NFT** | Spore Protocol — 7 NFT types, minting, marketplace |
| **8096** | **Live** | LiveKit rooms, 10 gift types, PK battles, real-time viewer tracking |
| **8097** | **Achievement** | 18 condition-driven SBT achievements across 5 categories |
| **8098** | **Governance** | DAO proposals, token-weighted voting |
| **8099** | **Bridge** | Cross-chain asset bridging |
| **8100** | **Transcode** | Video transcoding via Livepeer |
| **8101** | **Search** | MeiliSearch-powered full-text search |
| **8102** | **Moderation** | Content moderation and reporting |
| **8103** | **Messaging** | WebSocket DM system, ntfy.sh push notifications |
| **8104** | **Engagement** | Daily tasks, check-ins, anti-abuse rate limiting |
| **8105** | **AI Generation** | AI content generation proxy (text/music/video), API key management |
| — | **Recommendation** | Content recommendation engine |
| — | **Collaboration** | Real-time collaborative editing |

### Storage Engine

Nexus uses a **3-tier Hybrid Storage Engine** for progressive decentralization:

| Tier | Technology | Purpose |
|------|-----------|---------|
| 🔴 **Hot** | MinIO (S3) | Instant playback, low latency |
| 🟡 **Warm** | Filecoin (IPFS) | Decentralized redundancy via web3.storage |
| 🔵 **Cold** | Arweave | Permanent on-chain storage via Irys |

---

## 🔗 Web3 Integration

### Blockchain Protocols

| Protocol | Role | Implementation |
|----------|------|----------------|
| **[JoyID](https://joy.id)** | Passkey-based non-custodial wallet | `@joyid/ckb` — no seed phrases, biometric auth |
| **[Fiber Network](https://fiber.nervos.org)** | L2 micropayment channels | Per-second streaming payments via payment channels |
| **[Spore Protocol](https://spore.pro)** | Content NFT standard | 7 categories of on-chain Digital Objects (DOBs) |
| **[RGB++](https://github.com/ckb-cell/rgbpp-sdk)** | Isomorphic binding | Trustless multi-party revenue distribution |
| **[.bit (d.id)](https://d.id)** | Decentralized identity | Human-readable addresses (e.g., `creator.bit`) |
| **[CCC](https://github.com/nicomen/ckb-ccc)** | Universal connector | Unified wallet abstraction for JoyID, MetaMask, UniSat |
| **[Nostr](https://nostr.com)** | Social protocol | Decentralized social identity bridging |

### Network
- **Blockchain**: CKB Testnet (`https://testnet.ckb.dev`)
- **Layer 2**: Fiber Network for off-chain payment channels
- **Storage**: MinIO → Filecoin → Arweave progressive pipeline

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript 5.5** + **Vite 5**
- **Zustand** for state management (Auth, Points, UI stores)
- **React Query** — 64+ data fetching hooks
- **react-i18next** — Internationalization
- **Three.js** — 3D virtual rooms for Watch Party
- **Video.js** — Adaptive video player

### Backend
- **Fastify 4** — High-performance HTTP framework
- **Prisma 5** — Type-safe ORM with PostgreSQL
- **BullMQ** — Redis-backed job queue
- **Pino** — Structured logging

### Infrastructure
- **PostgreSQL 16** — Primary database
- **Redis 7** — Caching, sessions, rate limiting, pub/sub
- **MinIO** — S3-compatible object storage
- **MeiliSearch** — Full-text search engine
- **LiveKit** — WebRTC live streaming
- **Livepeer** — Decentralized video transcoding
- **Docker Compose** — Container orchestration

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18
- **Docker Desktop** (running)
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/alefnt/nexus-video-platform.git
cd nexus-video-platform
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Create Docker secrets directory
mkdir .secrets
echo "nexus_dev_2024" > .secrets/db_password
echo "your_jwt_secret_here" > .secrets/jwt_secret
echo "nexus_meili_dev_key" > .secrets/meili_key
echo "nexus_minio_2024" > .secrets/minio_password
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO, MeiliSearch
docker compose up -d
```

### 4. Initialize Database

```bash
# Push Prisma schema to database
npx dotenv -e .env.local -- npx prisma db push \
  --schema packages/database/prisma/schema.prisma

# Generate Prisma client
npx dotenv -e .env.local -- npx prisma generate \
  --schema packages/database/prisma/schema.prisma
```

### 5. Start Services

```bash
# Start all backend services (gateway + 3 service groups)
npm run dev:services

# In a new terminal, start the web frontend
npm run dev:web
```

### 6. Open the App

Visit **http://localhost:5173** in your browser. 🎉

---

## 📁 Project Structure

```
nexus-video-platform/
├── client-web/              # React SPA (Vite)
│   ├── src/
│   │   ├── pages/           # 50 page components
│   │   ├── components/      # 47+ reusable components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── stores/          # Zustand state stores
│   │   └── i18n/            # Internationalization
│   └── public/              # Static assets
├── services/                # 17 Fastify microservices
│   ├── identity/            # Auth gateway (:8080)
│   ├── payment/             # Payments & billing (:8091)
│   ├── content/             # Upload & storage (:8092)
│   ├── metadata/            # Content metadata (:8093)
│   ├── royalty/             # Revenue splits (:8094)
│   ├── nft/                 # NFT minting (:8095)
│   ├── live/                # Live streaming (:8096)
│   ├── achievement/         # SBT achievements (:8097)
│   ├── governance/          # DAO voting (:8098)
│   ├── messaging/           # Direct messages (:8103)
│   └── ...                  # + 7 more services
├── shared/                  # Shared libraries
│   ├── web3/                # Blockchain integrations
│   ├── storage/             # Hybrid storage engine
│   ├── payment/             # Payment providers
│   └── types/               # TypeScript type definitions
├── packages/
│   └── database/            # Prisma schema & migrations
├── contracts/               # Smart contract definitions
├── deploy/                  # Docker & deployment configs
├── tests/                   # E2E, integration, unit tests
└── docker-compose.yml       # Development infrastructure
```

---

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| **Microservices** | 18 |
| **Frontend Pages** | 55+ |
| **UI Components** | 47+ |
| **React Hooks** | 64+ |
| **Prisma Models** | 30+ |
| **NFT Categories** | 7 |
| **Achievement Types** | 18 |
| **Gift Types** | 10 |
| **OAuth Providers** | 5 (JoyID, Twitter, Google, TikTok, YouTube, Bilibili) |
| **AI Tool Categories** | 10 |
| **Languages** | TypeScript (100%) |

---

## 🧪 Testing

```bash
# Run service unit tests
npm run test:services

# Run E2E tests (Playwright)
npm run test:e2e
```

---

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">
  Built with ⚡ on <a href="https://www.nervos.org/">Nervos CKB</a>
</p>
