import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const MESSENGER_TOKEN_KEY = "messenger_rald_token";

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || "";
if (apiUrl) setBaseUrl(apiUrl);

// Wire RALD token into the API client — set once at startup, read dynamically
// so tokens stored by auth.tsx SSO callback are picked up immediately.
setAuthTokenGetter(() => localStorage.getItem(MESSENGER_TOKEN_KEY));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
