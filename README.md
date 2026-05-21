# Loop

**Audio-first civic platform** — built for community, culture, and public life in Africa.

Loop is not a private messenger. It is an open civic platform where communities gather in voice rooms, share updates, and coordinate around the things that matter — matches, town halls, announcements, music, and more.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Start, TanStack Router, Framer Motion |
| Realtime | Supabase Realtime (channels, presence, typing) |
| Database | Supabase PostgreSQL |
| Auth | RALD Auth — Phone OTP via Termii, Supabase session |
| API / SSR | Cloudflare Pages + Workers (TanStack Start SSR) |
| State | Zustand |
| UI | Tailwind CSS v4, Radix UI, oklch neon lemon green |
| Voice Rooms | Tencent TRTC (V1.5) |
| Design | African-first — large tap targets, low-data aware, Nigerian dial codes |

## Product Identity

- **Audio-first** — voice is the primary interaction, not text
- **Civic** — designed for communities, not private chats
- **African-first** — optimised for Android budget devices, 2G/3G networks, +234 and pan-African dial codes
- **Open spaces** — Loop Rooms are public or community-scoped voice spaces

## Auth Architecture (RALD)

Loop uses **RALD Auth** — phone-based OTP with Termii as the SMS delivery layer.

### Flow
1. User enters phone → Worker calls `/api/auth/send-otp`
2. Worker generates OTP, stores in Supabase, sends via Termii branded as "Loop"
3. User enters OTP → Worker calls `/api/auth/verify-otp`
4. Worker verifies, creates Supabase session → user is authenticated

No Twilio. No Firebase. Just Termii + Supabase.

## Routes

| Route | Description |
|---|---|
| `/login` | Phone OTP authentication (RALD) |
| `/onboarding` | Profile setup |
| `/loop` | **Loop Spaces** — open voice rooms for civic life |
| `/updates` | Community announcements feed |
| `/calls` | Direct voice calls |
| `/chats` | Chat threads |
| `/new-chat` | Start a conversation |
| `/profile` | Profile management |
| `/api/auth/send-otp` | RALD: send OTP via Termii |
| `/api/auth/verify-otp` | RALD: verify OTP, return session |

## CI / Deploy

```
push to main
  ├── typecheck (non-blocking, continue-on-error)
  └── deploy → Cloudflare Pages (SSR via _worker.js)
```

Build produces `dist/client/` (browser) + `dist/server/` (SSR worker).
CI copies `dist/server/index.js` + `dist/server/assets/` → `dist/client/` for Pages bundling.

## GitHub Actions Secrets

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `VITE_SUPABASE_URL` | Supabase project URL (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (build-time) |
| `SUPABASE_URL` | Supabase URL (runtime Worker secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (runtime) |
| `TERMII_API_KEY` | Termii key for RALD OTP delivery |

## Development

```bash
bun install
bun dev
```
