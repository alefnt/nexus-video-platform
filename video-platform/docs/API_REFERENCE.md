# Video Platform API Reference

This document provides a structured reference for the main API endpoints exposed by the Video Platform services. All services are accessed through the **Identity Service** (API Gateway) at the base URL (default: `http://localhost:8080`).

---

## Identity Service

Handles authentication, gateway routing, health checks, and metrics.

| Method | Path | Auth Required | Description | Example Response |
|--------|------|---------------|-------------|------------------|
| POST | `/auth/login` | No | Login (email, JoyID, Twitter, etc.) | `{ jwt, user: { id, ... } }` |
| POST | `/auth/verify` | No | Verify token or auth code | `{ jwt, user, offlineToken }` |
| GET | `/health` | No | Health check | `{ status: "ok" }` |
| GET | `/metrics` | No | Prometheus metrics | `text/plain` metrics output |

---

## Metadata Service

Video metadata, recommendations, trending, likes, and comments.

| Method | Path | Auth Required | Description | Example Response |
|--------|------|---------------|-------------|------------------|
| GET | `/metadata/list` | No | List all video metadata | `[{ id, title, creatorCkbAddress, ... }]` |
| GET | `/metadata/:id` | No | Get metadata by ID | `{ id, title, description, ... }` |
| GET | `/metadata/recommendations` | No | Get personalized recommendations | `[{ id, title, ... }]` |
| GET | `/metadata/trending` | No | Get trending videos | `[{ id, title, views, ... }]` |
| POST | `/metadata/like/:id` | Yes | Like a video | `{ ok: true, videoId, count, liked: true }` |
| GET | `/metadata/comments/:id` | No | Get comments for a video | `[{ id, userId, text, createdAt }]` |

---

## Payment Service

Payments, points, purchase, and redemption.

| Method | Path | Auth Required | Description | Example Response |
|--------|------|---------------|-------------|------------------|
| POST | `/payment/create` | Yes | Create payment/purchase | `{ orderId, amount, status }` |
| POST | `/payment/redeem` | Yes | Redeem purchase/voucher | `{ ok: true, entitlement }` |
| GET | `/payment/points/balance` | Yes | Get user points balance | `{ balance: number }` |
| POST | `/payment/points/redeem` | Yes | Redeem points | `{ ok: true, remaining }` |

---

## Content Service

Video streaming, tickets, HLS playback.

| Method | Path | Auth Required | Description | Example Response |
|--------|------|---------------|-------------|------------------|
| POST | `/content/ticket` | Yes | Obtain stream access ticket | `{ ticket, expiresAt }` |
| GET | `/content/stream/:id` | Yes | Get stream metadata/URL | `{ streamUrl, format, ... }` |
| GET | `/content/continue` | Yes | Get continue-watching list | `[{ videoId, positionSec, ... }]` |
| GET | `/content/hls/:id/index.m3u8` | No | HLS master playlist | `application/vnd.apple.mpegurl` |

---

## Live Service

Live streaming rooms, gifts, and room management.

| Method | Path | Auth Required | Description | Example Response |
|--------|------|---------------|-------------|------------------|
| GET | `/live/list` | No | List live rooms | `[{ roomId, title, viewerCount }]` |
| GET | `/live/rooms` | No | Get rooms overview | `[{ id, status, ... }]` |
| POST | `/live/room/create` | Yes | Create a live room | `{ roomId, token, ... }` |
| GET | `/live/gifts` | No | List available gifts | `[{ id, name, price }]` |

---

## Request Correlation

All responses include an `X-Request-Id` header for request tracing. Clients may optionally send `X-Request-Id` in requests to correlate logs across services; if not provided, the gateway generates a UUID.
