import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { bootstrapAuth } from "@/lib/auth-store";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-7xl font-bold text-gradient-primary">Lost.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn&apos;t find that page in the Loop.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full px-6 font-semibold text-sm transition active:scale-95"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)", color: "oklch(0.09 0.01 45)", height: 48 }}
          >
            Back to Loop
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <div
          className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "oklch(0.62 0.22 25 / 0.15)", border: "1px solid oklch(0.62 0.22 25 / 0.30)" }}
        >
          ⚡
        </div>
        <h1 className="text-xl font-bold tracking-tight">Signal interrupted</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Something went wrong. Try again — we&apos;ll re-establish the connection.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full px-5 font-semibold text-sm transition active:scale-95"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)", color: "oklch(0.09 0.01 45)", height: 44 }}
          >
            Try again
          </button>
          <Link
            to="/login"
            className="flex items-center rounded-full px-5 text-sm text-muted-foreground transition hover:text-foreground"
            style={{ height: 44, border: "1px solid oklch(1 0 0 / 12%)" }}
          >
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#160e05" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Loop Messenger" },
      { name: "description", content: "Private realtime messaging — by LILCKY STUDIO." },
      { property: "og:title", content: "Loop Messenger" },
      { property: "og:description", content: "Private realtime messaging — by LILCKY STUDIO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { bootstrapAuth(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        toastOptions={{ style: { background: "oklch(0.17 0.022 50)", border: "1px solid oklch(1 0 0 / 10%)" } }}
      />
    </QueryClientProvider>
  );
}
