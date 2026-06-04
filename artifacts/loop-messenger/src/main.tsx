import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const MESSENGER_TOKEN_KEY = "messenger_rald_token";

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

// Wire RALD token into the API client — set once at startup, read dynamically
// so tokens stored by auth.tsx SSO callback are picked up immediately.
setAuthTokenGetter(() => localStorage.getItem(MESSENGER_TOKEN_KEY));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
