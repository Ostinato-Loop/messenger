/**
 * Network Quality Detection — optimized for African 3G/4G/5G conditions
 * Adapts polling intervals, animation quality, and resource loading to network.
 */
import { useEffect, useState, useCallback } from "react";

export type NetworkQuality = "offline" | "2g" | "3g" | "4g" | "5g" | "wifi";

interface ConnectionInfo {
  quality: NetworkQuality;
  /** Recommended polling interval in ms */
  pollInterval: number;
  /** Whether to show full animations */
  richAnimations: boolean;
  /** Whether to prefetch resources */
  prefetch: boolean;
  /** Effective downlink in Mbps (approximate) */
  downlink: number;
}

function getQualityFromConnection(conn: any): NetworkQuality {
  if (!conn) return "4g";
  const type: string = conn.type || "";
  const ect: string = conn.effectiveType || "";
  if (type === "wifi") return "wifi";
  if (ect === "4g" && conn.downlink >= 10) return "5g";
  if (ect === "4g") return "4g";
  if (ect === "3g") return "3g";
  if (ect === "2g" || ect === "slow-2g") return "2g";
  return "4g";
}

function buildInfo(quality: NetworkQuality): ConnectionInfo {
  const map: Record<NetworkQuality, ConnectionInfo> = {
    offline: { quality, pollInterval: 0, richAnimations: false, prefetch: false, downlink: 0 },
    "2g":    { quality, pollInterval: 12000, richAnimations: false, prefetch: false, downlink: 0.05 },
    "3g":    { quality, pollInterval: 5000,  richAnimations: false, prefetch: false, downlink: 1.5 },
    "4g":    { quality, pollInterval: 3000,  richAnimations: true,  prefetch: true,  downlink: 10 },
    "5g":    { quality, pollInterval: 1500,  richAnimations: true,  prefetch: true,  downlink: 100 },
    wifi:    { quality, pollInterval: 2000,  richAnimations: true,  prefetch: true,  downlink: 50 },
  };
  return map[quality];
}

export function useNetworkQuality(): ConnectionInfo {
  const detect = useCallback((): NetworkQuality => {
    if (!navigator.onLine) return "offline";
    const conn = (navigator as any).connection ||
                 (navigator as any).mozConnection ||
                 (navigator as any).webkitConnection;
    return getQualityFromConnection(conn);
  }, []);

  const [info, setInfo] = useState<ConnectionInfo>(() => buildInfo(detect()));

  useEffect(() => {
    const update = () => setInfo(buildInfo(detect()));
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const conn = (navigator as any).connection ||
                 (navigator as any).mozConnection ||
                 (navigator as any).webkitConnection;
    conn?.addEventListener("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener("change", update);
    };
  }, [detect]);

  return info;
}

/** Offline banner hook */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return offline;
}
