import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  MessageSquare,
  Shield,
  Activity,
  LogOut,
  Search,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Wifi,
  Settings,
  ArrowLeft,
  BarChart3,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── API Base ──────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "";

async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw Object.assign(new Error((body.error as string) ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; today: number; online: number };
  messages: { total: number; today: number };
  conversations: { total: number };
  otp: { total: number; today: number };
  sessions: { active: number };
  charts: {
    dailySignups: Array<{ day: string; count: number }>;
    dailyMessages: Array<{ day: string; count: number }>;
  };
}

interface AdminUser {
  id: number;
  phone: string;
  displayName: string;
  bio?: string | null;
  avatar?: string | null;
  isOnline: boolean;
  lastSeen?: string | null;
  createdAt: string;
}

interface OtpLog {
  id: number;
  phone: string;
  attempts: number;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}

interface Session {
  sid: string;
  userId?: number | null;
  expire: string;
}

interface Config {
  termiiSenderId: string;
  termiiChannel: string;
  nodeEnv: string;
  adminPhonesConfigured: boolean;
  supabaseUrl: string | null;
  supabaseRealtimeEnabled: boolean;
  vapidConfigured: boolean;
  rtcConfigured: boolean;
  version: string;
}

// ── MiniBar chart ─────────────────────────────────────────────────────────────

function MiniBar({ data, color }: { data: Array<{ day: string; count: number }>; color: string }) {
  if (!data.length) return <div className="h-10 text-muted-foreground text-xs flex items-center">No data yet</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className={cn("w-full rounded-sm transition-all", color)}
            style={{ height: `${Math.max(4, (d.count / max) * 40)}px` }}
          />
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-popover border border-border text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-10 shadow-lg">
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-5 space-y-3"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-primary mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <span className="text-xs text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onPrev} disabled={page <= 1}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onNext} disabled={page >= totalPages}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    adminFetch("/api/admin/stats")
      .then(setStats)
      .catch(() => toast({ title: "Failed to load stats", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-muted/30 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Platform Overview</h2>
        <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5 text-white" />}
          label="Total Users"
          value={stats.users.total.toLocaleString()}
          sub={`+${stats.users.today} today · ${stats.users.online} online`}
          color="bg-primary/20 text-primary"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5 text-emerald-400" />}
          label="Messages Sent"
          value={stats.messages.total.toLocaleString()}
          sub={`+${stats.messages.today} today`}
          color="bg-emerald-500/20"
        />
        <StatCard
          icon={<Activity className="w-5 h-5 text-blue-400" />}
          label="Conversations"
          value={stats.conversations.total.toLocaleString()}
          color="bg-blue-500/20"
        />
        <StatCard
          icon={<Key className="w-5 h-5 text-amber-400" />}
          label="OTP Requests"
          value={stats.otp.total.toLocaleString()}
          sub={`${stats.otp.today} today`}
          color="bg-amber-500/20"
        />
        <StatCard
          icon={<Shield className="w-5 h-5 text-violet-400" />}
          label="Active Sessions"
          value={stats.sessions.active.toLocaleString()}
          color="bg-violet-500/20"
        />
        <StatCard
          icon={<Wifi className="w-5 h-5 text-cyan-400" />}
          label="Online Now"
          value={stats.users.online.toLocaleString()}
          color="bg-cyan-500/20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Users — Last 7 Days</p>
          <MiniBar data={stats.charts.dailySignups} color="bg-primary/70" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messages — Last 7 Days</p>
          <MiniBar data={stats.charts.dailyMessages} color="bg-emerald-500/70" />
        </div>
      </div>
    </div>
  );
}

// ── Tab: Users ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    adminFetch(`/api/admin/users?${params}`)
      .then((d: any) => { setUsers(d.users); setTotal(d.total); setTotalPages(d.totalPages); })
      .catch(() => toast({ title: "Failed to load users", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [page, q, toast]);

  useEffect(() => { load(); }, [load]);

  const revokeAllSessions = async (userId: number) => {
    setRevoking(userId);
    try {
      await adminFetch(`/api/admin/users/${userId}/sessions`, { method: "DELETE" });
      toast({ title: "Sessions revoked", description: `All sessions for user #${userId} have been invalidated.` });
    } catch {
      toast({ title: "Failed to revoke sessions", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone…"
            className="pl-9"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 text-xs shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{total.toLocaleString()} users</p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {u.displayName.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.displayName}</span>
                  {u.isOnline && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.phone}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0 hidden md:block">
                <div>{new Date(u.createdAt).toLocaleDateString()}</div>
                <div className="text-[10px]">#{u.id}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs shrink-0"
                disabled={revoking === u.id}
                onClick={() => revokeAllSessions(u.id)}
                title="Revoke all sessions for this user"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Revoke</span>
              </Button>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No users found</div>
          )}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

// ── Tab: OTP Log ──────────────────────────────────────────────────────────────

function OtpTab() {
  const [logs, setLogs] = useState<OtpLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    adminFetch(`/api/admin/otp?page=${page}`)
      .then((d: any) => { setLogs(d.logs); setTotal(d.total); setTotalPages(d.totalPages); })
      .catch(() => toast({ title: "Failed to load OTP logs", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  const flushExpired = async () => {
    setFlushing(true);
    try {
      const r: any = await adminFetch("/api/admin/otp/expired", { method: "DELETE" });
      toast({ title: "Flushed", description: `${r.deleted} expired OTP records deleted.` });
      load();
    } catch {
      toast({ title: "Failed to flush", variant: "destructive" });
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total.toLocaleString()} total OTP requests</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={flushExpired}
            disabled={flushing}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Flush Expired
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border"
            >
              <div className="shrink-0">
                {log.expired ? (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{log.phone}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant={log.expired ? "secondary" : "default"} className="text-[10px]">
                  {log.expired ? "Expired" : "Active"}
                </Badge>
                {log.attempts > 0 && (
                  <div className="text-[10px] text-amber-400 mt-0.5">{log.attempts} attempts</div>
                )}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No OTP records found</div>
          )}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

// ── Tab: Sessions ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    adminFetch("/api/admin/sessions")
      .then((d: any) => setSessions(d.sessions))
      .catch(() => toast({ title: "Failed to load sessions", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const revokeSession = async (sid: string) => {
    setRevoking(sid);
    try {
      await adminFetch(`/api/admin/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" });
      setSessions((s) => s.filter((x) => x.sid !== sid));
      toast({ title: "Session revoked" });
    } catch {
      toast({ title: "Failed to revoke session", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.sid}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border"
            >
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-muted-foreground truncate">{s.sid}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  {s.userId && <span>User #{s.userId}</span>}
                  <span>·</span>
                  <span>Expires {new Date(s.expire).toLocaleString()}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 shrink-0"
                disabled={revoking === s.sid}
                onClick={() => revokeSession(s.sid)}
                title="Revoke this session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No active sessions</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Config ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    adminFetch("/api/admin/config")
      .then(setConfig)
      .catch(() => toast({ title: "Failed to load config", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />;
  if (!config) return null;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Environment",          value: <Badge variant={config.nodeEnv === "production" ? "default" : "secondary"}>{config.nodeEnv}</Badge> },
    { label: "TERMII Sender ID",     value: <code className="text-primary text-sm">{config.termiiSenderId}</code> },
    { label: "TERMII Channel",       value: <code className="text-primary text-sm">{config.termiiChannel}</code> },
    { label: "Admin Phones Set",     value: config.adminPhonesConfigured ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-amber-400" /> },
    { label: "Supabase Realtime",    value: config.supabaseRealtimeEnabled ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-muted-foreground" /> },
    { label: "VAPID Push",           value: config.vapidConfigured ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-amber-400" /> },
    { label: "Tencent RTC",          value: config.rtcConfigured ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-muted-foreground" /> },
    { label: "Version",              value: <span className="text-sm text-muted-foreground">{config.version}</span> },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Runtime Configuration</h2>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="flex items-center">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground px-1">
        To modify configuration, update environment variables on the server and redeploy.
        Admin access is controlled by the <code className="text-primary">ADMIN_PHONES</code> env var.
      </p>
    </div>
  );
}

// ── Root Admin Page ───────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "otp" | "sessions" | "config";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview",  label: "Overview",  icon: <BarChart3 className="w-4 h-4" /> },
  { id: "users",     label: "Users",     icon: <Users className="w-4 h-4" /> },
  { id: "otp",       label: "OTP Log",   icon: <Key className="w-4 h-4" /> },
  { id: "sessions",  label: "Sessions",  icon: <Shield className="w-4 h-4" /> },
  { id: "config",    label: "Config",    icon: <Settings className="w-4 h-4" /> },
];

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();
  const [tab, setTab] = useState<Tab>("overview");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Verify admin access by probing the stats endpoint
  useEffect(() => {
    if (meLoading) return;
    if (!me) { setLocation("/auth"); return; }

    adminFetch("/api/admin/stats")
      .then(() => setAuthorized(true))
      .catch((err: any) => {
        if (err.status === 403 || err.status === 401) {
          setAuthorized(false);
        } else {
          // Network error etc — still let them in, individual tabs will handle it
          setAuthorized(true);
        }
      });
  }, [me, meLoading, setLocation]);

  if (meLoading || authorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your account does not have admin privileges.
          Contact the system administrator to request access.
        </p>
        <Button onClick={() => setLocation("/chats")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Chats
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Loop Admin</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:flex">RALD Console</Badge>
          </div>
          <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
            {me?.displayName} · {me?.phone}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview"  && <OverviewTab />}
            {tab === "users"     && <UsersTab />}
            {tab === "otp"       && <OtpTab />}
            {tab === "sessions"  && <SessionsTab />}
            {tab === "config"    && <ConfigTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
