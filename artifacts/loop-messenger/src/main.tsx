import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Resolve the API base URL.
// VITE_API_URL (set in Cloudflare Pages env vars) is the canonical source.
// Fallback to the production CF Worker so the deployed SPA always hits the
// correct API even when the env var is not yet set.
// The generated API client (orval baseUrl="/api") will prepend /api to all
// paths, so all calls land at e.g. https://messenger.rald.cloud/api/conversations.
const apiUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://messenger.rald.cloud";

setBaseUrl(apiUrl);

// Session Standard V2: No localStorage token getter.
// Authentication is handled exclusively via the messenger_session HttpOnly cookie
// (set by the Cloudflare Worker at messenger.rald.cloud). The custom-fetch layer
// sends credentials: "include" on every request so the browser attaches the
// cookie automatically. setAuthTokenGetter is intentionally NOT called here.

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
