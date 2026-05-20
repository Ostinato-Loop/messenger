# Loop Messenger

A premium private realtime messaging platform — neon-purple, futuristic, production-ready.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Start, TanStack Router, Framer Motion |
| Realtime | Supabase Realtime (channels, presence, typing) |
| Database | Supabase PostgreSQL |
| Auth | RALD Auth — Phone OTP via Termii, Supabase session |
| API / SSR | Cloudflare Workers + TanStack Start |
| State | Zustand |
| UI | Tailwind CSS v4, Radix UI, oklch neon-purple |
| Calls (V1.5) | Tencent TRTC |
| Push | OneSignal |
| Presence Cache | Upstash Redis |
| Assets | Cloudflare R2 |

## Auth Architecture (RALD)

Loop Messenger uses **RALD Auth** — phone-based OTP with Termii as the SMS delivery layer.

### Flow
1. User enters phone → `supabase.auth.signInWithOtp({ phone })`
2. Supabase calls our Worker at `/api/sms-hook` (custom SMS provider webhook)
3. Worker relays the OTP to Termii → Termii sends SMS branded as "Loop"
4. User enters OTP → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
5. Supabase session created → user is authenticated

### Supabase Configuration (one-time)
Go to: **Supabase Dashboard → Authentication → SMS Providers → Custom**

| Field | Value |
|---|---|
| Webhook URL | `https://messenger.<account>.workers.dev/api/sms-hook` |
| HTTP Method | POST |

No Twilio or other third-party SMS provider needed.

## Routes

| Route | Description |
|---|---|
| `/login` | Phone OTP authentication (RALD-protected) |
| `/onboarding` | Profile setup |
| `/chats` | Chat list with realtime presence |
| `/chat/:chatId` | Realtime messaging thread |
| `/new-chat` | Start a new conversation |
| `/calls` | Voice/video (Tencent TRTC — V1.5) |
| `/updates` | Updates feed |
| `/loop` | Rooms & sync experiences |
| `/profile` | Profile management |
| `/api/sms-hook` | Internal: Supabase → Termii SMS relay |

## Development

```bash
bun install
bun dev
```

## Environment Variables

```bash
cp .env.example .env.local
```

Required:
- `VITE_SUPABASE_URL` — `https://onxdcikfttdmnhofsuwo.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `TERMII_API_KEY` — Termii API key (server-side only)

## GitHub Actions Secrets

All secrets are already configured via CI. To re-configure:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers + Pages deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `VITE_SUPABASE_URL` | Supabase project URL (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (build-time) |
| `SUPABASE_URL` | Supabase URL (runtime Worker secret) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (runtime Worker secret) |
| `TERMII_API_KEY` | Termii key for RALD OTP delivery (runtime Worker secret) |

## CI / Deploy Pipeline

```
push to main
  ├── typecheck (non-blocking)
  ├── build → uploads dist/
  ├── deploy-worker → Cloudflare Workers (SSR)
  └── deploy-pages  → Cloudflare Pages (static CDN assets)
```
