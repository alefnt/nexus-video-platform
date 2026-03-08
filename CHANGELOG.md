# Changelog

All notable changes to this project will be documented in this file.

## [2.2.0] - 2026-03-08

### ✨ New Features

#### 🎰 Daily Spin Wheel Overhaul
- **SVG Pie Wheel** — Replaced broken gradient ring with proper 8-segment SVG wheel with labels
- **Spin Animation** — 4-second cubic-bezier deceleration with random prize selection
- **Daily Spin Limit** — 3 free spins per day (resets at 00:00 UTC via localStorage)
- **Task-Based Earning** — Completing daily tasks grants +1 bonus spin
- **Visual Spin Counter** — Dot indicators (yellow=base, purple=bonus, gray=used) + counter text
- **Client-Side Fallback** — Spin works offline/demo mode when API unavailable

#### 🧭 Sidebar Navigation Restructure
- **AI Studio** expandable section under PLATFORM with sub-links:
  - 🛒 Tool Marketplace
  - 📝 AI Article Lab
  - 🎬 AI Video Lab
  - 🎵 AI Music Lab
  - ⚙️ AI Settings (API Key config)
- **My AI Tools** page under MY ASSET — Personal tool dashboard

#### 📦 My AI Tools Dashboard (`/my-ai-tools`)
- **Purchased Tools** tab — Usage progress bars, expiry tracking, renewal
- **Published Tools** tab — User count, revenue (PTS), status, editing
- **Stats Cards** — Active subscriptions, total API calls, total spent, tools published

### 🔧 Improvements
- Identity service restarted with new OAuth routes (TikTok/YouTube/Bilibili now respond properly)
- Spin button shows remaining count and disables when exhausted
- Fixed PlatformBindings connect error handling for better UX

---

## [2.1.0] - 2026-03-08

### ✨ New Features

#### 🤖 AI Studio
- **AI Article Lab** — AI-powered article generation with OpenAI, DeepSeek, Ollama providers
- **AI Music Lab** — Music generation via Suno API with real-time progress tracking
- **AI Video Lab** — Video generation via Runway Gen-4.5, Kling AI, and custom providers
- **AI Settings** — BYOK (Bring Your Own Key) with AES-256 encryption, per-provider config, and connection testing
- **AI Generation Microservice** (`services/ai-generation` :8105) — Backend proxy for AI API calls with encrypted key management
- **AI Local Storage** — Generated content stored locally until user chooses to publish

#### 🛒 AI Tool Marketplace
- **Marketplace Page** (`/ai-tools`) — Browse, search, and filter AI tools across 10 categories
- **Featured Tools** — Curated tools carousel with ratings, reviews, and pricing
- **Tool Detail Modal** — Full tool details with Web3 info (Spore NFT, Fiber Network, RGB++)
- **Creator Submission** (`/ai-tools/submit`) — 3-step wizard for publishing tools (Info → Pricing → Tutorial & NFT)
- **Spore NFT Minting** — Optional ownership NFT via Spore Protocol
- **Revenue Split Model** — 70% Creator / 20% Platform / 10% Referrer via RGB++

#### 🔐 OAuth Integration
- **TikTok OAuth 2.0** — Full PKCE flow with token exchange and profile fetch
- **YouTube OAuth 2.0** — Google OAuth with YouTube channel scopes
- **Bilibili OAuth 2.0** — Full PKCE flow for Bilibili account binding
- **6 new API endpoints** — `/auth/{platform}/start` and `/auth/{platform}/callback` for each provider
- **Redis state management** — Secure OAuth state and PKCE verifier storage

#### 🧭 Navigation & UX
- **AI Tool Market** sidebar entry — Quick access to the marketplace
- **Start Creating** section on AI Settings — Post-configuration navigation to AI Labs
- **DAO Governance page** — Token-based proposal and voting UI
- **AI Royalty Dashboard** — Revenue tracking with RGB++ split visualization

### 🔧 Improvements
- Updated `PlatformBindings.tsx` with real OAuth flow initiation (was previously "Coming Soon")
- Added `hide-scrollbar` CSS utility for horizontal scroll areas
- Enhanced Identity Gateway with TikTok/YouTube/Bilibili route handlers

### 📊 Metrics Update
- Microservices: 17 → 18
- Frontend Pages: 50 → 55+
- OAuth Providers: 3 → 6 (added TikTok, YouTube, Bilibili)
- AI Tool Categories: 10

---

## [2.0.0] - 2026-03-08

### ✨ New Features
- Full UI implementation with Nexus design system
- Cross-media content feed (Videos, Music, Articles, Live)
- Watch Party with 3D virtual rooms
- NFT Marketplace with Spore Protocol
- Creator Studio with analytics dashboard
- Daily Quests and achievement system
- Per-second streaming payments via Fiber Network
- RGB++ royalty distribution
- JoyID Passkey authentication
- Multi-language support (EN/ZH)

---

## [1.0.0] - Initial Release

### Features
- Basic video platform with content upload and playback
- User authentication with email/password
- PostgreSQL + Redis infrastructure
- Docker Compose development environment
