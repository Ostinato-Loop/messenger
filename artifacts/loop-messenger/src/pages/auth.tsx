/**
 * Loop Messenger — Auth page
 * Session Standard V2: localStorage RETIRED. Authentication is cookie-only.
 *
 * Silent SSO cascade:
 *   Step 1: ?rald_token= in URL → POST /auth/rald-sso → server sets messenger_session
 *           cookie (HttpOnly, Secure, SameSite=Lax, Domain=.rald.cloud) → enter app
 *   Step 2: GET /auth/silent { credentials: "include" } → messenger_session cookie sent
 *           automatically → server validates + refreshes cookie → enter app
 *   Step 3: No session → redirect to profiles.rald.cloud/login
 *
 * No token is ever stored in localStorage or sessionStorage.
 * The messenger_session HttpOnly cookie is managed exclusively by the
 * Cloudflare Worker at messenger.rald.cloud and is invisible to JS.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import loopLogo from "@assets/IMG_3832_1779603911915.jpeg";

const RALD_AUTH_UI = (import.meta.env.VITE_RALD_AUTH_URL as string | undefined) ?? "https://profiles.rald.cloud";

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
      // POST the raw handoff token to the Worker. The Worker validates it,
      // looks up the RALD identity, and sets a messenger_session HttpOnly cookie.
      // No token value is ever stored by the client.
      if (raldToken && (!paramApp || paramApp === "messenger")) {
        try {
          const res = await fetch(`${API_BASE}/auth/rald-sso`, {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" },
            body:        JSON.stringify({ rald_token: raldToken }),
          });
          if (!res.ok) throw new Error("RALD SSO rejected");

          window.history.replaceState({}, "", window.location.pathname);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/chats");
          return;
        } catch {
          setStatus("error");
          setErrorMsg("Session link expired. Redirecting to sign-in…");
          setTimeout(() => redirectToProfiles(), 2500);
          return;
        }
      }

      // ── Step 2: silent SSO via messenger_session cookie ────────────────────
      // The browser sends the HttpOnly cookie automatically because we use
      // credentials: "include". The Worker validates and optionally refreshes
      // the cookie TTL. No JS can read the cookie value.
      try {
        const silentRes = await fetch(`${API_BASE}/auth/silent`, {
          credentials: "include",
        });
        if (silentRes.ok) {
          const silent = await silentRes.json() as { valid: boolean };
          if (silent.valid) {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setLocation("/chats");
            return;
          }
        }
      } catch { /* no cookie session — fall through to redirect */ }

      // ── Step 3: redirect to profiles ──────────────────────────────────────
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
