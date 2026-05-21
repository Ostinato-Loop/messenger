# Loop Messenger

**"Your Identity. Your Loop."**

A production-grade, edge-native communications platform powered by RALD Auth, TERMII OTP, and Tencent RTC. Built for Africa-first mobile-first users with a futuristic neon-orange identity.

---

## Live URLs

| Service | URL |
|---------|-----|
| Frontend (Cloudflare Pages) | https://messenger.ostloop.name.ng |
| API Gateway (Cloudflare Worker) | https://loop-messenger-api.d5a1cd03b76f467430034af64a7062fd.workers.dev |
| API Origin (Replit/VPS) | Set via `API_ORIGIN_URL` secret |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TanStack Query, Wouter, Framer Motion, Tailwind CSS v4 |
| Build | Vite 7, pnpm workspaces, TypeScript 5.9 |
| API Gateway | Cloudflare Workers (Edge) |
| API Server | Express 5, Node.js 24 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | RALD Auth — OTP via TERMII, session via express-session |
| Realtime | Supabase Realtime (V1 polling fallback) |
| RTC | Tencent TRTC (voice notes V1, voice/video calls V2) |
| CI/CD | GitHub Actions → Cloudflare Pages + Workers |
| OTP | TERMII SMS Gateway |
| Runtime | Bun (local dev) / Node.js 24 (CI/production) |

---

## Monorepo Structure

```
messenger/
├── artifacts/
│   ├── api-server/          # Express 5 API server (deployed to Replit/VPS)
│   └── loop-messenger/      # React + Vite frontend (deployed to Cloudflare Pages)
├── workers/
│   └── loop-messenger-api/  # Cloudflare Worker — OTP relay + API gateway + CORS
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/    # Generated TanStack Query hooks (from orval)
│   ├── api-zod/             # Generated Zod validators (from orval)
│   └── db/                  # Drizzle ORM schema + migrations
├── .github/
│   └── workflows/
│       ├── ci.yml           # Type check + build (all branches)
│       ├── deploy-api.yml   # Deploy Cloudflare Worker (main only)
│       └── deploy-pages.yml # Deploy Cloudflare Pages (main only)
└── scripts/                 # Post-merge and utility scripts
```

---

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL database

### Setup

```bash
# Clone
git clone https://github.com/Ostinato-Loop/messenger.git
cd messenger

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, TERMII_API_KEY, etc.

# Generate DB schema
pnpm --filter @workspace/db run push

# Run codegen (generates API hooks + Zod validators)
pnpm --filter @workspace/api-spec run codegen

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (new terminal)
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/loop-messenger run dev

# Start Cloudflare Worker locally (new terminal)
cd workers/loop-messenger-api && npm run dev
```

---

## Environment Variables

### API Server (`artifacts/api-server`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Express session secret (min 32 chars) |
| `TERMII_API_KEY` | ✅ | TERMII API key for OTP delivery |
| `TERMII_SENDER_ID` | ✅ | TERMII sender ID (e.g. N-Alert) |
| `TENCENT_SDKAPPID` | ✅ | Tencent TRTC App ID |
| `TENCENT_SECRET_KEY` | ✅ | Tencent TRTC Secret Key |
| `NODE_ENV` | ✅ | `production` or `development` |

### Cloudflare Worker (`workers/loop-messenger-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `TERMII_API_KEY` | ✅ | Set via `wrangler secret put TERMII_API_KEY` |
| `API_ORIGIN` | ✅ | Set via `wrangler secret put API_ORIGIN` |
| `TERMII_SENDER_ID` | set in wrangler.toml | Default: `N-Alert` |

### GitHub Secrets (repository settings)

| Secret | Used By | Description |
|--------|---------|-------------|
| `CLOUDFLARE_API_TOKEN` | deploy-pages.yml | Token with Cloudflare Pages:Edit permission |
| `CLOUDFLARE_WORKERS_TOKEN` | deploy-api.yml | Token with Workers Scripts:Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | both deploy workflows | Your Cloudflare account ID |
| `TERMII_API_KEY` | deploy-api.yml | Pushed to Worker as secret |
| `API_ORIGIN_URL` | deploy-api.yml | Your API server URL (pushed as `API_ORIGIN` to Worker) |

### GitHub Variables (repository settings → Variables)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Cloudflare Worker URL (e.g. `https://loop-messenger-api.xxx.workers.dev`) |

---

## CI/CD Pipeline

```
Push to main
    │
    ├─► ci.yml (all branches)
    │       ├── pnpm install
    │       ├── codegen
    │       ├── tsc typecheck (libs + api-server)
    │       ├── build api-server
    │       └── build loop-messenger frontend
    │
    ├─► deploy-api.yml (main only, when worker files change)
    │       ├── npm install (worker deps)
    │       ├── wrangler deploy (Cloudflare Worker)
    │       ├── wrangler secret put TERMII_API_KEY
    │       └── wrangler secret put API_ORIGIN
    │
    └─► deploy-pages.yml (main only)
            ├── pnpm install + codegen
            ├── vite build
            └── wrangler pages deploy → Cloudflare Pages
```

All workflows gracefully skip deployment steps if Cloudflare credentials are not configured, keeping CI green.

---

## RALD Auth Flow

```
User enters phone number (Nigerian +234 formatting auto-applied)
    │
    ▼
POST /api/auth/send-otp
    │
    ├─► Cloudflare Worker validates + rate limits
    ├─► TERMII API sends OTP via SMS
    └─► OTP stored in PostgreSQL (10 min TTL, max 5 attempts)
    │
    ▼
User enters 6-digit OTP
    │
    ▼
POST /api/auth/verify-otp
    │
    ├─► OTP validated, deleted from DB
    ├─► User created or retrieved from DB
    └─► Session cookie set (30 day persistent)
    │
    ▼
Authenticated session — all subsequent requests carry cookie
```

---

## Tencent RTC Architecture

Loop Messenger uses a **provider abstraction layer** for all real-time communication infrastructure. This ensures Tencent can be replaced or extended without touching business logic.

```
Loop Core APIs
    │
    ▼
Communication Provider Layer (provider-agnostic interface)
    │
    ├─► IVoiceProvider (voice notes, recording, playback)
    ├─► ICallProvider (voice/video calls — V2)
    └─► IStreamProvider (live streaming — V2/V3)
    │
    ▼
TencentRTCProvider (current implementation)
    │
    ├─► TRTC UserSig generation (backend)
    ├─► TRTC SDK (frontend)
    └─► Tencent Cloud network optimization
```

### TRTC Token Generation

```
GET /api/rtc/token?userId={id}&roomId={roomId}
    │
    ▼
Backend generates UserSig:
    1. HMAC-SHA256(secretKey, "TLS.identifier:{userId}\nTLS.sdkappid:{appId}\nTLS.time:{ts}\nTLS.expire:{exp}\n")
    2. Compress JSON with zlib deflate-raw
    3. Base64URL encode
    │
    ▼
Frontend initializes TRTC SDK with:
    { sdkAppId, userId, userSig, roomId }
```

---

## Database Schema

```sql
users                  — phone-based identity, display name, avatar, online status
otp_requests           — OTP codes with TTL and attempt counting
conversations          — direct and group conversations
conversation_members   — membership, role, last-read tracking
messages               — text, image, audio, file, system messages
message_reactions      — emoji reactions per message per user
```

---

## Product Roadmap

### ✅ V1 — Secure Messaging MVP (LIVE)

**Identity & Auth**
- [x] RALD Auth — OTP-only login via TERMII
- [x] Nigerian phone formatting (+234 auto-apply)
- [x] Device session persistence (30-day cookies)
- [x] OTP cooldown + 5-attempt abuse prevention
- [x] Rate limiting on all auth endpoints

**Messaging**
- [x] Real-time messaging (4s polling, upgradeable to Supabase Realtime)
- [x] Read receipts + unread counts
- [x] Typing indicator architecture
- [x] Message reactions (❤️ 😂 😮 😢 👍 🔥)
- [x] Edit + soft-delete messages
- [x] Reply-to threading (data model)
- [x] Group chats with admin roles
- [x] Direct (1:1) chats
- [x] User search by name or phone

**Voice Notes**
- [x] Voice note recording (MediaRecorder API)
- [x] Voice note playback in chat
- [x] Tencent TRTC infrastructure ready

**Platform**
- [x] Mobile-first PWA (installable)
- [x] African 3G/4G optimized (reduced motion, lazy loading, gzip)
- [x] Dark cyber OS theme — neon orange branding
- [x] RALD Auth splash screen + identity frame
- [x] Cloudflare Edge delivery
- [x] GitHub Actions CI/CD

---

### 🔜 V2 — Communication Expansion

**Voice & Video**
- [ ] Tencent TRTC voice calls (1:1)
- [ ] Tencent TRTC video calls (1:1)
- [ ] Group voice calls (up to 12 participants)
- [ ] Audio spaces (listen-only rooms)
- [ ] Screen sharing

**Social Layer**
- [ ] Channels (broadcast lists)
- [ ] Communities (public groups with discovery)
- [ ] Public profiles + username handles
- [ ] QR code login / contact sharing
- [ ] Status updates (24hr expiry)
- [ ] Contact discovery via phone book sync

**Moderation**
- [ ] Report system
- [ ] Admin dashboard
- [ ] Audit logs

---

### 🔮 V3 — Business & API Platform

**Developer Infrastructure**
- [ ] RALD Identity APIs (public)
- [ ] Messaging SDK (npm package)
- [ ] OTP APIs (white-label)
- [ ] Webhook delivery system
- [ ] API key management
- [ ] Usage analytics dashboard
- [ ] Developer portal + docs

**Enterprise**
- [ ] Team workspaces
- [ ] Business verification badges
- [ ] Enterprise dashboards
- [ ] SLA monitoring

---

### 💰 V4 — Digital Commerce + Creator Network

**Payments**
- [ ] Wallet system (NGN first)
- [ ] Escrow for transactions
- [ ] Pay-to-chat channels
- [ ] Creator subscriptions

**Commerce**
- [ ] Digital storefronts in chat
- [ ] Verified business identities
- [ ] Invoice + receipt generation
- [ ] Integration with Nigerian payment rails (Paystack/Flutterwave)

---

### 🌐 V5 — RALD Network

**Universal Identity**
- [ ] Cross-platform RALD identity
- [ ] Multi-app authentication (single RALD account across apps)
- [ ] AI communication assistant (message drafting, translation, summarization)
- [ ] Enterprise federation (Active Directory / SAML integration)
- [ ] Decentralized communication layer
- [ ] Commerce APIs (B2B payments infrastructure)

---

## Security

- OTP abuse prevention (rate limiting + attempt counting)
- RLS-safe database queries
- Secure HTTP-only cookies (`sameSite: none` in production)
- Helmet.js security headers
- CORS restricted to known origins
- Cloudflare protection (DDoS, bot mitigation)
- Session expiration + device logout
- Tencent TRTC UserSig rotation (configurable TTL)

---

## Contributing

This repository follows the **trunk-based development** model. All changes go to `main` via pull requests.

**Before every PR:**
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm run build
```

All four must pass before submitting.

---

## License & Legal

© Lilcky Studio Limited. All rights reserved.

Loop Messenger is a registered product of Lilcky Studio Limited, Nigeria.
RALD Auth is the identity infrastructure powering Loop Messenger.

For legal enquiries: legal@lilcky.studio
