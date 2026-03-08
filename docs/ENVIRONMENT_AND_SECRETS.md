# Environment Variables & Secrets

This document describes all environment variables used by the video-platform project. Reference `.env.example` (root), `client-web/.env.example`, and `.env.production.example` for templates.

---

## Environment Variables Reference

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string. Format: `postgresql://user:password@host:port/database` |
| `DB_PASSWORD` | Yes (Docker) | — | Database password used in Docker/deploy setups |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | — | Redis connection URL. Format: `redis://[:password@]host:port` |

### Blockchain / CKB

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CKB_NODE_URL` | Yes | `https://testnet.ckb.dev` | CKB node RPC URL |
| `CKB_INDEXER_URL` | Yes | `https://testnet.ckb.dev/indexer` | CKB indexer URL |
| `CKB_DEPOSIT_ADDRESS` | Yes | — | CKB deposit address for payments |
| `FIBER_RPC_URL` | Yes | — | Fiber Network RPC URL (e.g. `http://18.163.221.211:8227`) |
| `FIBER_ALLOW_MOCK` | No | `false` | Allow mock mode for Fiber |
| `FIBER_ENABLE_SIGCHECK` | No | `false` | Enable signature checks in Fiber |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | JWT signing secret. Must be ≥ 32 characters. Generate with: `openssl rand -hex 32` |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Frontend app URL (CORS, redirects) |
| `VITE_API_GATEWAY_URL` | Yes | `http://localhost:8080` | API gateway URL (injected at build) |
| `VITE_JOYID_APP_URL` | No | — | JoyID app URL (e.g. `https://testnet.joyid.dev`) |
| `VITE_JOYID_ICON_URL` | No | `/joyid.png` | JoyID icon URL |
| `VITE_BIT_ICON_URL` | No | `/bit.png` | .bit icon URL |
| `VITE_EMAIL_ICON_URL` | No | `/email.png` | Email icon URL |
| `VITE_DEV_AUTO_LOGIN` | No | — | Enable auto-login for development |
| `VITE_ENABLE_REAL_POINTS_BUY` | No | — | Enable real points purchase in dev |
| `VITE_SENTRY_DSN` | No | — | Sentry DSN for frontend error tracking |
| `VITE_ENABLE_ANALYTICS` | No | `0` | Enable analytics (0 or 1) |

### Services (Ports)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IDENTITY_PORT` | No | `8080` | Identity service port |
| `PAYMENT_PORT` | No | `8091` | Payment service port |
| `CONTENT_PORT` | No | `8092` | Content service port |
| `METADATA_PORT` | No | `8093` | Metadata service port |
| `ROYALTY_PORT` | No | `8094` | Royalty service port |
| `NFT_PORT` | No | `8095` | NFT service port |
| `LIVE_PORT` | No | `8096` | Live streaming service port |
| `ACHIEVEMENT_PORT` | No | `8097` | Achievement service port |
| `GOVERNANCE_PORT` | No | `8098` | Governance service port |
| `BRIDGE_PORT` | No | `8099` | Bridge service port |
| `TRANSCODE_PORT` | No | `8100` | Transcode service port |
| `SEARCH_PORT` | No | `8101` | Search service port |
| `MODERATION_PORT` | No | `8102` | Moderation service port |
| `MESSAGING_PORT` | No | `8103` | Messaging service port |
| `ENGAGEMENT_PORT` | No | `8104` | Engagement service port |

### Search

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEILISEARCH_URL` | Yes | `http://localhost:7700` | Meilisearch server URL |
| `MEILISEARCH_KEY` | Yes | — | Meilisearch master key |

### Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NTFY_URL` | Yes | `http://localhost:8070` | ntfy.sh server URL for push notifications |
| `NTFY_TOPIC` | No | `nexus-video` | ntfy topic name |

### Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_ENDPOINT` | Yes | `http://localhost:9000` | MinIO/S3-compatible endpoint |
| `MINIO_ACCESS_KEY` | Yes | `nexus` | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | — | MinIO secret key |

### LiveKit

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LIVEKIT_API_KEY` | Yes | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | — | LiveKit API secret |
| `LIVEKIT_URL` | Yes | `ws://localhost:7880` | LiveKit WebSocket URL (use `wss://` in production) |

### Livepeer

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LIVEPEER_API_KEY` | Yes | — | Livepeer API key for transcoding |

### Monitoring

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | No | — | Sentry DSN for backend error tracking |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `ENABLE_TRACING` | No | `true` | Enable distributed tracing |
| `GRAFANA_PASSWORD` | No | `admin` | Grafana admin password (Docker deploy) |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Yes | — | SMTP server host |
| `SMTP_PORT` | No | `465` | SMTP port |
| `SMTP_SECURE` | No | `true` | Use TLS |
| `SMTP_USER` | Yes | — | SMTP username |
| `SMTP_PASS` | Yes | — | SMTP password |
| `SMTP_FROM` | Yes | — | From address for outgoing emails |

### Payment & Misc

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYMENT_PUBLIC_BASE` | No | `http://localhost:8091` | Public base URL for payment service |
| `ENABLE_POINTS_JOYID` | No | `1` | Enable JoyID CKB payment (0 or 1) |
| `ENABLE_ADMIN_CKB_INTENTS` | No | `0` | Enable admin CKB intents (use cautiously) |
| `API_GATEWAY_URL` | No | — | API gateway URL (Docker deploy) |

---

## Secret Management

### Best Practices

1. **Never commit `.env` or `.env.local`** — Add them to `.gitignore` and ensure they are never pushed.
2. **Use a vault in production** — Prefer HashiCorp Vault, AWS Secrets Manager, or equivalent instead of plain `.env` files.
3. **Rotate `JWT_SECRET` periodically** — Plan for key rotation; invalidates existing tokens when changed.
4. **Separate secrets by environment** — Use different credentials for dev, staging, and production.
5. **Principle of least privilege** — Give services only the credentials they need.
6. **Audit access** — Log who accesses secrets and when.

### Generating Strong Secrets

```bash
# JWT_SECRET (32+ chars)
openssl rand -hex 32

# Generic secret
openssl rand -base64 32
```

---

## Local Development Setup

### Step-by-step

1. **Copy environment templates**

   ```bash
   cp .env.example .env.local
   cp client-web/.env.example client-web/.env.local
   ```

2. **Fill in required values** in `.env.local`:

   - `DATABASE_URL` — Your local PostgreSQL (e.g. `postgresql://nexus:password@localhost:5432/nexus_video`)
   - `REDIS_URL` — Your local Redis (e.g. `redis://:nexus123@localhost:6379`)
   - `JWT_SECRET` — A strong secret (≥ 32 chars)
   - `CKB_*` — Testnet or mainnet CKB config
   - `MEILISEARCH_KEY`, `LIVEKIT_*`, `LIVEPEER_API_KEY`, `MINIO_*` — As needed for local services

3. **Fill `client-web/.env.local`** (optional overrides):

   - `VITE_API_GATEWAY_URL` — Usually `http://localhost:8080`
   - `VITE_JOYID_APP_URL` — e.g. `https://testnet.joyid.dev`

4. **Start backing services** (PostgreSQL, Redis, MinIO, Meilisearch, etc.) — via Docker or local install.

5. **Start the platform**:

   ```bash
   npm ci
   npm run db:push -w packages/database   # Apply migrations
   npm run dev:services                   # Backend services
   npm run dev:web                        # Frontend (in another terminal)
   # Or: npm run dev:all
   ```

6. **Verify** — Open `http://localhost:5173` and `http://localhost:8080/health`.

---

## Related Files

- **Root:** `.env.example`, `.env.production.example`
- **Client:** `client-web/.env.example`
- **Docker:** `deploy/docker/.env.example`
