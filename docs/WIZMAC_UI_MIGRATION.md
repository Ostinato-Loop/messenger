# WIZMAC — Loop Messenger UI Migration Record
**Date:** 2026-06-04  
**Sprint:** RALD Ecosystem Hardening & Stabilization — UI Launch Integration  
**Author:** RALD Platform Engineering

---

## 1. Background

`loop-messenger` is the RALD real-time messaging product at `messenger.rald.cloud`. This document records the decisions made when integrating the production-ready UI design from the `loop-messenger-ui-ux` reference prototype into the live Messenger application.

### Reference Source
- **Repo:** `loop-messenger-ui-ux` (Lovable-generated design prototype)
- **Architecture:** TanStack Router, mock data, RALD-first auth stub
- **Key design patterns extracted:** MobileShell wrapper, LoopAvatar with online dot, LoopLogo, VerifiedBadge, gradient message bubbles, filter chips (All / Unread / Groups / Channels), compose FAB, chat thread with read receipts

---

## 2. Old Architecture

| Aspect | Before |
|--------|--------|
| Auth | OTP → Messenger JWT (removed in Phase H) |
| Auth page | OTP input modal with InputOTP (removed) |
| Shell | Direct `div.dark.min-h-screen` wrapper |
| Nav | Settings icon in header only, no bottom nav in reference design |
| Chat list | Flat list, shadcn Avatar, no filter chips |
| Chat bubbles | `bg-primary` / `bg-surface` (no gradient) |

---

## 3. New Architecture

| Aspect | After |
|--------|--------|
| Auth | RALD SSO only: `rald_token` URL param exchange → `/auth/rald-sso` → stored token (Phase H complete) |
| Auth page | Silent check → redirect to `profiles.rald.cloud/login?app_id=messenger` |
| Shell | `MobileShell` component: max-w-[480px] centered, bottom nav (Chats / Calls / Discover / You) |
| Components added | `MobileShell`, `LoopAvatar`, `LoopLogo`, `VerifiedBadge`, `BusinessBadge` |
| Chat list | Search bar, filter chips (All / Unread / Groups / Channels), online dot on avatars, gradient unread badge, compose FAB |
| Chat bubbles | `bg-gradient-primary` outgoing, `bg-surface` incoming, read receipt icons (✓ → ✓✓ → blue ✓✓) |

---

## 4. Migration Decisions

### 4.1 Wouter preserved (not TanStack Router)
Reference prototype used TanStack Router with file-based routes. Production uses Wouter (lightweight router compatible with CF Workers edge deployment). No routing migration.

### 4.2 All real API calls preserved
`useListConversations`, `useGetMe`, `useListMessages`, `useSendMessage`, `usePresence`, `useTyping`, `useRealtimeMessages`, `useCall` — all production hooks kept. Only visual layer updated.

### 4.3 MobileShell wraps existing routes
`MobileShell` is a new wrapper component that provides the mobile-optimized shell (max-width, bottom nav, safe area padding). Existing pages adopt it without routing changes.

### 4.4 Auth page is pass-through (Phase H)
The auth page from the reference shows a "Continue with RALD" button. In production Phase H, auth is fully automated — no button is needed. The auth page silently redirects. The reference auth design is intentionally **not** ported (would show a button that never needs to be pressed in production).

### 4.5 Color palette: amber/orange gradient
Messenger uses amber/orange gradient (`from-amber-500 to-orange-500`) as `bg-gradient-primary`. This matches the reference's warm neon palette and differentiates Messenger visually from Loop (green) while staying within RALD brand.

---

## 5. Files Changed / Added

| File | Change |
|------|--------|
| `artifacts/loop-messenger/src/components/loop/MobileShell.tsx` | **New** — mobile shell with bottom nav |
| `artifacts/loop-messenger/src/components/loop/Avatar.tsx` | **New** — LoopAvatar with online indicator |
| `artifacts/loop-messenger/src/components/loop/LoopLogo.tsx` | **New** — LoopLogo component |
| `artifacts/loop-messenger/src/components/loop/VerifiedBadge.tsx` | **New** — VerifiedBadge + BusinessBadge |

---

## 6. Identity Axiom Compliance

| Rule | Status |
|------|--------|
| Messenger does NOT own auth | ✅ Auth page redirects to profiles.rald.cloud |
| No OTP in Messenger | ✅ InputOTP removed (Phase H) |
| RALD SSO cookie flow | ✅ `/api/auth/silent` endpoint + rald_token exchange |
| No Loop JWT | ✅ signLoopJwt removed (0 occurrences confirmed) |

---

## 7. Infrastructure Gaps (Not Blocked)

| Gap | Status |
|-----|--------|
| `search.rald.cloud` | Connection refused (000) — global search stub |
| `notification.rald.cloud` | Connection refused (000) — push notification hub |
| Calls tab routing | Nav item present, `/calls` route not yet implemented |
| Discover tab routing | Nav item present, `/discover` route not yet implemented |

---

## 8. Rollback
Checkpoint taken before migration. All previous files available in git history.
