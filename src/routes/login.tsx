import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Phone, RefreshCw, Shield } from "lucide-react";

import { LoopMark } from "@/components/LoopMark";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  ssr: false,
});

type Mode = "signin" | "join";
type Step = "phone" | "otp";
type BoxState = "idle" | "typing" | "error" | "success";

const RALD_API = import.meta.env.VITE_RALD_API_URL || "";

// ── RALD corner state colours ──────────────────────────────────────────────
// idle=transparent, typing=amber, error=red, success=green
const CORNER: Record<BoxState, { border: string; filter: string }> = {
  idle:    { border: "2.5px solid oklch(1 0 0 / 14%)",        filter: "none" },
  typing:  { border: "2.5px solid oklch(0.78 0.20 65)",       filter: "drop-shadow(0 0 6px oklch(0.78 0.20 65 / 0.80))" },
  error:   { border: "2.5px solid oklch(0.62 0.22 25)",       filter: "drop-shadow(0 0 7px oklch(0.62 0.22 25 / 0.85))" },
  success: { border: "2.5px solid oklch(0.72 0.20 145)",      filter: "drop-shadow(0 0 6px oklch(0.72 0.20 145 / 0.80))" },
};

const BOX_SHADOW: Record<BoxState, string> = {
  idle:    "none",
  typing:  "0 0 0 1px oklch(0.78 0.20 65 / 0.22), 0 0 40px -6px oklch(0.78 0.20 65 / 0.18)",
  error:   "0 0 0 1px oklch(0.62 0.22 25 / 0.35), 0 0 40px -6px oklch(0.62 0.22 25 / 0.25)",
  success: "0 0 0 1px oklch(0.72 0.20 145 / 0.35), 0 0 40px -6px oklch(0.72 0.20 145 / 0.22)",
};

function Corner({ pos, state }: { pos: "tl" | "tr" | "bl" | "br"; state: BoxState }) {
  const c = CORNER[state];
  const style: React.CSSProperties = {
    position: "absolute", width: 28, height: 28,
    transition: "all 0.3s ease",
    filter: c.filter,
    ...(pos === "tl" && { top: 0, left: 0,   borderTop: c.border, borderLeft: c.border,   borderRadius: "1.5rem 0 0 0" }),
    ...(pos === "tr" && { top: 0, right: 0,  borderTop: c.border, borderRight: c.border,  borderRadius: "0 1.5rem 0 0" }),
    ...(pos === "bl" && { bottom: 0, left: 0,  borderBottom: c.border, borderLeft: c.border,  borderRadius: "0 0 0 1.5rem" }),
    ...(pos === "br" && { bottom: 0, right: 0, borderBottom: c.border, borderRight: c.border, borderRadius: "0 0 1.5rem 0" }),
  };
  return <span aria-hidden="true" style={style} />;
}

async function raldFetch(path: string, body: Record<string, string>) {
  const base = RALD_API.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, hydrated, setSession } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [boxState, setBoxState] = useState<BoxState>("idle");
  const [shaking, setShaking] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hydrated || !session) return;
    navigate({ to: profile?.onboarding_completed ? "/chats" : "/onboarding", replace: true });
  }, [hydrated, session, profile, navigate]);

  useEffect(() => { phoneRef.current?.focus(); }, []);
  useEffect(() => { if (step === "otp") setTimeout(() => otpRef.current?.focus(), 80); }, [step]);

  const cleanPhone = () => {
    const p = phone.trim();
    return p.startsWith("+") ? p : `+${p.replace(/\D/g, "")}`;
  };

  function shake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }

  // ── Send OTP via RALD/Termii ─────────────────────────────────────────────
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const p = cleanPhone();
    if (p.length < 8) { toast.error("Enter a valid phone number"); shake(); setBoxState("error"); return; }
    setLoading(true);
    setBoxState("typing");

    const { ok, data } = await raldFetch("/api/auth/send-otp", { phone: p, mode });
    setLoading(false);

    if (!ok) {
      toast.error((data.error as string) || "Failed to send code — check your number");
      setBoxState("error");
      shake();
      return;
    }
    setBoxState("success");
    toast.success("Code sent to " + p);
    setTimeout(() => {
      setStep("otp");
      setBoxState("idle");
    }, 400);
  }

  // ── Verify OTP via RALD ──────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Enter the 6-digit code"); shake(); setBoxState("error"); return; }
    setLoading(true);
    setBoxState("typing");

    const { ok, data } = await raldFetch("/api/auth/verify-otp", {
      phone: cleanPhone(),
      otp: otp.trim(),
      mode,
    });
    setLoading(false);

    if (!ok) {
      toast.error((data.error as string) || "Wrong code — try again");
      setBoxState("error");
      shake();
      return;
    }

    setBoxState("success");
    // RALD returns a Supabase session token — hydrate it
    if (data.access_token && typeof data.access_token === "string") {
      const { createClient } = await import("@supabase/supabase-js");
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const sb = createClient(url, key);
      await sb.auth.setSession({
        access_token: data.access_token as string,
        refresh_token: (data.refresh_token as string) || "",
      });
    }
    toast.success(mode === "join" ? "Welcome to Loop!" : "Welcome back!");
  }

  const isPhone = step === "phone";

  const modeLabel: Record<Mode, string> = {
    signin: "Welcome back",
    join:   "Join Loop",
  };
  const modeSubtitle: Record<Mode, string> = {
    signin: "Enter your phone — we'll send a code",
    join:   "Your phone is your identity on Loop",
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-10 safe-top safe-bottom overflow-hidden">
      {/* Background glow — neon lemon only */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 rounded-full animate-breathe"
          style={{ background: "radial-gradient(ellipse, oklch(0.92 0.30 122 / 0.10) 0%, transparent 70%)" }}
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-2 flex flex-col items-center gap-2"
      >
        <LoopMark size={52} />
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/80 mt-1">
          Audio-first civic platform
        </p>
      </motion.div>

      {/* Kente accent */}
      <div className="kente-strip mb-6 w-12" />

      {/* RALD AUTH BOX */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full max-w-sm rounded-3xl p-6 glass-raised transition-all duration-300${shaking ? " animate-shake" : ""}`}
        style={{ boxShadow: BOX_SHADOW[boxState] }}
      >
        {/* Corner accent brackets */}
        <Corner pos="tl" state={boxState} />
        <Corner pos="tr" state={boxState} />
        <Corner pos="bl" state={boxState} />
        <Corner pos="br" state={boxState} />

        {/* Mode tabs — simplified to 2 modes */}
        <div className="mb-5 flex rounded-2xl p-1" style={{ background: "oklch(1 0 0 / 6%)" }}>
          {(["signin", "join"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setStep("phone"); setOtp(""); setBoxState("idle"); }}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
              style={
                mode === m
                  ? { background: "var(--gradient-primary)", color: "oklch(0.07 0.01 140)" }
                  : { color: "oklch(0.62 0.018 135)" }
              }
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* RALD AUTH badge */}
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-0.5 text-[10px] font-bold tracking-widest"
          style={{ color: "oklch(0.78 0.20 65)", borderColor: "oklch(0.78 0.20 65 / 0.5)" }}>
          <Shield size={10} />
          RALD AUTH
        </div>

        <h2 className="mb-1 text-xl font-bold text-foreground">{modeLabel[mode]}</h2>
        <p className="mb-5 text-sm text-muted-foreground leading-relaxed">{modeSubtitle[mode]}</p>

        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form
              key="phone-form"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSendCode}
              className="flex flex-col gap-3"
            >
              {/* Phone input — large tap target for African mobile */}
              <label
                className="flex items-center gap-3 rounded-2xl px-4 py-4 transition-all"
                style={{ background: "oklch(1 0 0 / 7%)", border: "1px solid oklch(1 0 0 / 10%)" }}
              >
                <Phone size={18} className="shrink-0 text-muted-foreground" />
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+234 800 000 0000"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setBoxState(e.target.value.length > 0 ? "typing" : "idle");
                  }}
                  onFocus={() => setBoxState(phone.length > 0 ? "typing" : "typing")}
                  onBlur={() => { if (boxState === "typing") setBoxState("idle"); }}
                  className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
                />
              </label>

              {/* Submit — heartbeat ONLY fires after tap (loading state) */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.97]"
                style={
                  loading
                    ? { background: "var(--gradient-primary)", animation: "heartbeat 0.85s ease-in-out infinite", color: "oklch(0.07 0.01 140)", boxShadow: "none" }
                    : { background: "var(--gradient-primary)", color: "oklch(0.07 0.01 140)", boxShadow: "var(--shadow-glow)" }
                }
              >
                {loading ? "Sending code…" : "Send code"}
                {!loading && <ArrowRight size={16} />}
              </button>

              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                By continuing you accept Loop's Terms &amp; Privacy Policy
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleVerifyOtp}
              className="flex flex-col gap-3"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                Code sent to <span className="font-semibold text-foreground">{cleanPhone()}</span>.{" "}
                Check your SMS.
              </p>

              {/* OTP input — large, numeric keyboard */}
              <label
                className="flex items-center gap-3 rounded-2xl px-4 py-4 transition-all"
                style={{ background: "oklch(1 0 0 / 7%)", border: "1px solid oklch(1 0 0 / 10%)" }}
              >
                <Shield size={18} className="shrink-0 text-muted-foreground" />
                <input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setOtp(v);
                    setBoxState(v.length > 0 ? "typing" : "idle");
                  }}
                  onFocus={() => setBoxState("typing")}
                  onBlur={() => { if (boxState === "typing") setBoxState("idle"); }}
                  className="flex-1 bg-transparent text-2xl tracking-[0.55em] text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
                />
              </label>

              {/* Submit — heartbeat ONLY fires after tap (loading state) */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.97]"
                style={
                  loading
                    ? { background: "var(--gradient-primary)", animation: "heartbeat 0.85s ease-in-out infinite", color: "oklch(0.07 0.01 140)" }
                    : { background: "var(--gradient-primary)", color: "oklch(0.07 0.01 140)", boxShadow: "var(--shadow-glow)" }
                }
              >
                {loading ? "Verifying…" : mode === "join" ? "Create account" : "Enter Loop"}
                {!loading && <ArrowRight size={16} />}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setBoxState("idle"); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground transition-colors py-2"
                >
                  <ChevronLeft size={14} /> Wrong number
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                  className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground transition-colors py-2"
                >
                  <RefreshCw size={12} /> Resend code
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
