# Loop Messenger MA — Mobile App

React Native (Expo) companion to the Loop Messenger web app.

## Stack
- Expo 53 · Expo Router 4
- Supabase (Auth + Realtime + Storage)
- Tencent TRTC (voice/video calls — native build required)
- African-first design — warm amber/gold palette

## Features (V1 → V2)
- **Phone OTP auth** — Supabase phone + Termii SMS
- **RALD auth box** — 4-corner colour indicators (amber=typing, red=error, green=success)
- **Real-time chat** — Supabase Realtime, inverted FlatList, typing indicators, read receipts
- **Rich messages** — text, image, audio, file, reactions, swipe-to-reply
- **Loop Rooms** — Sports, Hangout, Event (Music + Watch coming V1.5)
- **Voice/video calls** — TRTC UI (native build required for real calls)
- **Profile** — avatar upload to Supabase Storage, bio, settings
- **New chat** — search users, DM or group creation
- **Calls history** — logged in Supabase `calls` table
- **Updates tab** — coming soon (V1.5)

## Setup

```bash
cd mobile
cp .env.example .env.local
# Fill in your EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install   # or bun install
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Env vars required

| Key | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://onxdcikfttdmnhofsuwo.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
