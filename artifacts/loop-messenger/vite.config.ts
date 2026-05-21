import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const basePath = process.env.BASE_PATH;
if (!basePath) throw new Error("BASE_PATH environment variable is required but was not provided.");

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // African 3G/4G/5G optimization: aggressive chunk splitting + compression
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // Granular manual chunks so first paint is minimal
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-core";
          if (id.includes("node_modules/framer-motion")) return "framer-motion";
          if (id.includes("node_modules/@tanstack")) return "tanstack";
          if (id.includes("node_modules/date-fns")) return "date-fns";
          if (id.includes("node_modules/wouter")) return "router";
          if (id.includes("node_modules/lucide-react")) return "icons";
          if (id.includes("node_modules/zod") || id.includes("node_modules/react-hook-form")) return "forms";
          if (id.includes("node_modules/@radix-ui")) return "radix";
          if (id.includes("src/components/ui/")) return "ui";
          if (id.includes("src/pages/")) return "pages";
        },
        // Content-hash filenames for long-term caching on Cloudflare edge
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
    // Minify aggressively
    minify: "esbuild",
    target: "es2020",
    // Don't inline assets > 4kb — serve from CDN instead
    assetsInlineLimit: 4096,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
});
