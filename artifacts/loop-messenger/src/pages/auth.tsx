/**
 * Loop Messenger — Auth page
 * Phase H / Sprint 01: Identity Axiom. Messenger does NOT own authentication.
 * Silent SSO cascade:
 *   Step 1: ?rald_token= in URL → exchange → enter app
 *   Step 2: Stored token valid  → enter app
 *   Step 3: rald_session cookie → /auth/silent → enter app
 *   Step 4: No session          → redirect to profiles.rald.cloud/login
 *
 * FIX (session-ttl): Step 1 now stores the server-issued session token
 * (data.token from the SSO exchange response) instead of the raw URL token.
 * The raw URL token may be a short-lived 5-minute Loop handoff token, which
 * caused Messenger to log users out 5 minutes after arriving from Loop.
 * The worker re-signs a full 7-day session token on every SSO exchange.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import loopLogo from "@assets/IMG_3832_1779603911915.jpeg";

const MESSENGER_TOKEN_KEY = "messenger_rald_token";
const RALD_AUTH_UI = (import.meta.env.VITE_RALD_AUTH_URL as string | undefined) ?? "https://profiles.rald.cloud";

// API_BASE is the root of the CF Worker (no /api suffix — auth.tsx calls /auth/* directly).
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://messenger.rald.cloud";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const queryClient     = useQueryClient();
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      const params    = new URLSearchParams(window.location.search);
      const raldToken = params.get("rald_token");
      const paramApp  = params.get("app_id");

      // ── Step 1: handoff token in URL ───────────────────────────────────────
      if (raldToken && (!paramApp || paramApp === "messenger")) {
        try {
          const res = await fetch(`${API_BASE}/auth/rald-sso`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ rald_token: raldToken }),
          });
          if (!res.ok) throw new Error("RALD SSO rejected");

          // FIX (session-ttl): Store the server-issued session token, NOT the raw URL
          // raldToken. The URL token may be a 5-minute Loop handoff token; the server
          // re-signs a 7-day Messenger session token and returns it as data.token.
          const data = await res.json() as { token?: string };
          const sessionToken = data.token ?? raldToken;
          localStorage.setItem(MESSENGER_TOKEN_KEY, sessionToken);

          window.history.replaceState({}, "", window.location.pathname);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/chats");
          return;
        } catch (e) {
          setStatus("error");
          setErrorMsg("Session link expired. Redirecting to sign-in…");
          setTimeout(() => redirectToProfiles(), 2500);
          return;
        }
      }

      // ── Step 2: validate stored token via /auth/me ─────────────────────────
      // Calls the CF Worker's GET /auth/me (JWT decode — no DB round-trip).
      const stored = localStorage.getItem(MESSENGER_TOKEN_KEY);
      if (stored) {
        try {
          const r = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (r.ok) {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setLocation("/chats");
            return;
          }
          // 401 = expired/invalid — clear and fall through to re-auth.
          localStorage.removeItem(MESSENGER_TOKEN_KEY);
        } catch { /* network error — fall through */ }
      }

      // ── Step 3: silent SSO via shared rald_session cookie (domain=.rald.cloud) ─
      // The cookie is set by the Messenger worker on SSO exchange and refreshed
      // on every /auth/silent call. Falls through if no cookie or token expired.
      try {
        const silentRes = await fetch(`${API_BASE}/auth/silent`, { credentials: "include" });
        if (silentRes.ok) {
          const silent = await silentRes.json() as { valid: boolean; access_token?: string };
          if (silent.valid && silent.access_token) {
            localStorage.setItem(MESSENGER_TOKEN_KEY, silent.access_token!);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setLocation("/chats");
            return;
          }
        }
      } catch { /* no cookie session available — fall through to redirect */ }

      // ── Step 4: redirect to profiles ──────────────────────────────────────
      redirectToProfiles();
    };

    run().catch(console.error);
  }, [queryClient, setLocation]);

  function redirectToProfiles() {
    const redirectTo = encodeURIComponent(`${window.location.origin}/auth`);
    window.location.href = `${RALD_AUTH_UI}/login?app_id=messenger&redirect_to=${redirectTo}`;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <img src={loopLogo} alt="Messenger" className="w-16 h-16 rounded-2xl object-cover mx-auto" />

        {status === "checking" && (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
            <p className="text-white/50 text-sm">Connecting to RALD Profiles…</p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-white/80 text-sm font-medium">Sign-in link expired</p>
            <p className="text-white/40 text-xs">{errorMsg}</p>
          </>
        )}

        <p className="text-white/20 text-xs">
          Secured by{" "}
          <span className="font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            RALD
          </span>
        </p>
      </div>
    </div>
  );
}
