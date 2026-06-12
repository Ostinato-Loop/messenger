// Loop Messenger — Cross-App Navigation Helpers
// Session Standard V2: localStorage RETIRED.
// Cross-app navigation relies on the shared rald_session HttpOnly cookie
// (Domain=.rald.cloud). No token value is ever read or forwarded by JS.
// The destination app's /auth/silent route validates the shared cookie and
// signs the user in without any URL token parameter.
// LILCKY STUDIO LIMITED

const PROFILES_URL = "https://profiles.rald.cloud";
const LOOP_URL     = "https://loop.rald.cloud";

/**
 * Open RALD Profiles in a new tab.
 * The rald_session cookie (Domain=.rald.cloud) is shared across all *.rald.cloud
 * subdomains. Profiles will silently validate it on /auth/silent and sign the
 * user in without any URL token parameter.
 */
export function openProfiles(path = "/"): void {
  window.open(`${PROFILES_URL}${path}`, "_blank", "noopener,noreferrer");
}

/**
 * Open Loop in a new tab.
 * The rald_session cookie (Domain=.rald.cloud) is shared across all *.rald.cloud
 * subdomains. Loop will silently validate it on /auth/silent and sign the user
 * in without any URL token parameter.
 */
export function openLoop(path = "/"): void {
  window.open(`${LOOP_URL}${path}`, "_blank", "noopener,noreferrer");
}
