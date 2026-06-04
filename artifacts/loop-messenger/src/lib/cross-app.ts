// Loop Messenger — Cross-App Navigation Helpers
// Sprint 01: Priority 4 — No dead ends between RALD products.
// D-011: Cross-App Navigation
//   Messenger → Profiles (View Profile)
//   Messenger → Loop (Join Community)
// LILCKY STUDIO LIMITED

const RALD_TOKEN_KEY = "messenger_rald_token";
const PROFILES_URL   = "https://profiles.rald.cloud";
const LOOP_URL       = "https://loop.rald.cloud";

function getStoredToken(): string | null {
  try { return localStorage.getItem(RALD_TOKEN_KEY); } catch { return null; }
}

function isTokenValid(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    const p = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p.exp === "number" && p.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

/**
 * Open RALD Profiles in a new tab.
 * If a valid RALD token is stored, it is passed as ?rald_token= so the user
 * lands directly on Profiles without re-authenticating.
 * Falls back to the Profiles login screen if no valid token exists.
 */
export function openProfiles(path = "/"): void {
  const token  = getStoredToken();
  const target = token && isTokenValid(token)
    ? `${PROFILES_URL}${path}?rald_token=${encodeURIComponent(token)}&app_id=profiles`
    : `${PROFILES_URL}/login?app_id=profiles&redirect_to=${encodeURIComponent(PROFILES_URL + path)}`;
  window.open(target, "_blank", "noopener,noreferrer");
}

/**
 * Open Loop in a new tab.
 * If a valid RALD token is stored, it is passed as ?rald_token= so the user
 * lands directly on Loop without re-authenticating.
 * Falls back to the Loop login screen if no valid token exists.
 */
export function openLoop(path = "/"): void {
  const token  = getStoredToken();
  const target = token && isTokenValid(token)
    ? `${LOOP_URL}${path}?rald_token=${encodeURIComponent(token)}&app_id=loop`
    : `${LOOP_URL}/login?app_id=loop&redirect_to=${encodeURIComponent(LOOP_URL + path)}`;
  window.open(target, "_blank", "noopener,noreferrer");
}
