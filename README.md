# Loop Messenger

  A premium private realtime messaging platform — neon-purple, futuristic, production-ready.

  ## Stack

  | Layer | Technology |
  |---|---|
  | Frontend | React 19, TanStack Start, TanStack Router, Framer Motion |
  | Realtime | Supabase Realtime (channels, presence, typing) |
  | Database | Supabase PostgreSQL |
  | Auth | Supabase Phone OTP (no email) |
  | API / SSR | Cloudflare Workers + TanStack Start |
  | State | Zustand |
  | UI | Tailwind CSS v4, Radix UI, oklch neon-purple |
  | Calls (V1.5) | Tencent TRTC |
  | Push | OneSignal |
  | Presence Cache | Upstash Redis |
  | Assets | Cloudflare R2 |

  ## Routes

  | Route | Description |
  |---|---|
  | `/login` | Phone OTP authentication |
  | `/onboarding` | Profile setup |
  | `/chats` | Chat list with realtime presence |
  | `/chat/:chatId` | Realtime messaging thread |
  | `/new-chat` | Start a new conversation |
  | `/calls` | Voice/video (Tencent TRTC) |
  | `/updates` | Updates feed |
  | `/loop` | Rooms & sync experiences |
  | `/profile` | Profile management |

  ## Development

  ```bash
  bun install
  bun dev
  ```

  ## Environment Variables

  ```bash
  cp .env.example .env.local
  ```

  Required for development:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key (Settings → API in Supabase dashboard)

  ## GitHub Actions Setup

  Add these secrets at **Settings → Secrets → Actions**:

  | Secret | Where to get it |
  |---|---|
  | `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens |
  | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |
  | `VITE_SUPABASE_URL` | `https://onxdcikfttdmnhofsuwo.supabase.co` |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Settings → API → anon/public key |

  Once set, pushing to `main` auto-deploys to Cloudflare Workers.
  