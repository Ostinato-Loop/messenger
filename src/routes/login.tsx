import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Phone, RefreshCw, Shield } from "lucide-react";

import { LoopMark } from "@/components/LoopMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  ssr: false,
});

type Mode = "signin" | "join" | "reset";
type Step = "phone" | "otp";
type BoxState = "idle" | "typing" | "error" | "success";

const CORNER: Record<BoxState, { border: string; filter: string }> = {
  idle:    { border: "2.5px solid oklch(1 0 0 / 14%)",        filter: "none" },
  typing:  { border: "2.5px solid oklch(0.78 0.20 65)",       filter: "drop-shadow(0 0 6px oklch(0.78 0.20 65 / 0.75))" },
  error:   { border: "2.5px solid oklch(0.62 0.22 25)",       filter: "drop-shadow(0 0 7px oklch(0.62 0.22 25 / 0.80))" },
  success: { border: "2.5px solid oklch(0.72 0.20 145)",      filter: "drop-shadow(0 0 6px oklch(0.72 0.20 145 / 0.75))" },
};

const BOX_SHADOW: Record<BoxState, string> = {
  idle:    "none",
  typing:  "0 0 0 1px oklch(0.78 0.20 65 / 0.20), 0 0 40px -6px oklch(0.78 0.20 65 / 0.16)",
  error:   "0 0 0 1px oklch(0.62 0.22 25 / 0.32), 0 0 40px -6px oklch(0.62 0.22 25 / 0.22)",
  success: "0 0 0 1px oklch(0.72 0.20 145 / 0.32), 0 0 40px -6px oklch(0.72 0.20 145 / 0.20)",
};

function Corner({ pos, state }: { pos: "tl" | "tr" | "bl" | "br"; state: BoxState }) {
  const c = CORNER[state];
  const R = "1.5rem 0 0 0";
  const style: React.CSSProperties = {
    position: "absolute", width: 26, height: 26,
    transition: "all 0.3s ease",
    filter: c.filter,
    ...(pos === "tl" && { top: 0, left: 0, borderTop: c.border, borderLeft: c.border, borderRadius: R }),
    ...(pos === "tr" && { top: 0, right: 0, borderTop: c.border, borderRight: c.border, borderRadius: R.split(" ").reverse().join(" ") }),
    ...(pos === "bl" && { bottom: 0, left: 0, borderBottom: c.border, borderLeft: c.border, borderRadius: `0 0 0 1.5rem` }),
    ...(pos === "br" && { bottom: 0, right: 0, borderBottom: c.border, borderRight: c.border, borderRadius: `0 0 1.5rem 0` }),
  };
  return <span aria-hidden="true" style={style} />;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, hydrated } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [boxState, setBoxState] = useState<BoxState>("idle");
  const [failCount, setFailCount] = useState(0);
  const [shaking, setShaking] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

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

  function shake() { setShaking(true); setTimeout(() => setShaking(false), 650); }

  function switchMode(m: Mode) {
    setMode(m);
    setStep("phone");
    setBoxState(phone.trim() ? "typing" : "idle");
    setOtp("");
    setFailCount(0);
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: cleanPhone() });
    setLoading(false);
    if (error) { setBoxState("error"); shake(); toast.error(error.message); return; }
    toast.success("Code sent via RALD Auth ✓");
    setStep("otp");
    setBoxState("typing");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4 || loading) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: cleanPhone(), token: otp.trim(), type: "sms" });
    setLoading(false);
    if (error) {
      const n = failCount + 1;
      setFailCount(n);
      setBoxState("error");
      shake();
      toast.error(n >= 3 ? "Too many attempts — request a new code below." : `Wrong code · ${3 - n} attempt${3 - n !== 1 ? "s" : ""} left`);
      return;
    }
    setBoxState("success");
    toast.success("Welcome to Loop 🌍");
  }

  async function resendCode() {
    if (!phone || loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: cleanPhone() });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setFailCount(0); setOtp(""); setBoxState("typing");
    toast.success("New code sent");
  }

  const TABS: { id: Mode; label: string }[] = [
    { id: "signin", label: "Sign In" },
    { id: "join",   label: "Create"  },
    { id: "reset",  label: "Forgot"  },
  ];

  const HEADER = {
    signin: { phone: "Welcome back", otp: "Verify your number" },
    join:   { phone: "Join Loop",    otp: "Verify your number" },
    reset:  { phone: "Reset access", otp: "Enter your code"   },
  } as const;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10 safe-top safe-bottom overflow-hidden">
      {/* Background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: "80vmin", height: "80vmin", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.76 0.18 65 / 0.16), transparent 68%)" }} />
        <div style={{ position: "absolute", bottom: "-15%", right: "-8%", width: "50vmin", height: "50vmin", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.58 0.18 145 / 0.10), transparent 70%)" }} />
      </div>

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 flex flex-col items-center gap-3"
      >
        <div className="relative">
          <div aria-hidden="true" style={{ position: "absolute", inset: -14, borderRadius: "50%", background: "oklch(0.76 0.18 65 / 0.22)", filter: "blur(22px)", animation: "breathe 4.5s ease-in-out infinite" }} />
          <LoopMark size={70} className="relative" />
        </div>
        <div className="text-center">
          <h1 className="text-[26px] font-bold tracking-tight">
            <span className="text-gradient-primary">Loop</span> Messenger
          </h1>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.34em] text-muted-foreground/80">
            A LILCKY STUDIO product
          </p>
        </div>
      </motion.div>

      {/* ─── RALD Auth Box ─── */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{
          opacity: 1, y: 0, scale: 1,
          x: shaking ? [0, -7, 7, -7, 7, -5, 5, -2, 2, 0] : 0,
        }}
        transition={{
          duration: 0.5, ease: [0.22, 1, 0.36, 1],
          x: { duration: 0.55, times: [0, .1, .2, .3, .4, .5, .6, .7, .85, 1] },
        }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 368,
          borderRadius: "1.5rem",
          padding: "1.5rem",
          background: "color-mix(in oklab, oklch(0.13 0.018 45) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid oklch(1 0 0 / 8%)",
          boxShadow: BOX_SHADOW[boxState],
          transition: "box-shadow 0.35s ease",
        }}
      >
        {/* Four corners */}
        <Corner pos="tl" state={boxState} />
        <Corner pos="tr" state={boxState} />
        <Corner pos="bl" state={boxState} />
        <Corner pos="br" state={boxState} />

        {/* Mode tabs */}
        <div style={{ display: "flex", borderRadius: "1rem", background: "oklch(1 0 0 / 6%)", padding: 4, marginBottom: "1.4rem" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchMode(t.id)}
              style={{
                flex: 1,
                borderRadius: "0.75rem",
                padding: "0.5rem 0",
                fontSize: 13,
                fontWeight: 700,
                transition: "all 0.2s ease",
                minHeight: 36,
                ...(mode === t.id
                  ? { background: "var(--gradient-primary)", color: "oklch(0.09 0.01 45)", boxShadow: "0 2px 16px oklch(0.76 0.18 65 / 0.40)" }
                  : { color: "oklch(0.60 0.022 55)", background: "transparent" }),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "oklch(0.76 0.18 65 / 0.12)", color: "oklch(0.76 0.18 65)", borderRadius: 999, padding: "2px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em" }}>
            🔒 RALD Auth
          </span>
          <h2 style={{ marginTop: 8, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-display)" }}>
            {step === "phone" ? HEADER[mode].phone : HEADER[mode].otp}
          </h2>
          <p style={{ marginTop: 4, fontSize: 13, color: "oklch(0.62 0.022 55)" }}>
            {step === "phone"
              ? "Enter your phone number for a secure one-time code"
              : `Code sent to ${cleanPhone()} — check your SMS`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form
              key="phone"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.22 }}
              onSubmit={sendOtp}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: "1rem", padding: "14px 16px", background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 11%)", cursor: "text" }}>
                <Phone size={17} style={{ color: "oklch(0.62 0.022 55)", flexShrink: 0 }} />
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+234 800 000 0000"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setBoxState("typing"); }}
                  onFocus={() => { if (boxState === "idle") setBoxState("typing"); }}
                  onBlur={() => { if (!phone.trim()) setBoxState("idle"); }}
                  style={{ flex: 1, minWidth: 0, background: "transparent", fontSize: 16, outline: "none", color: "inherit" }}
                />
              </label>

              <button
                type="submit"
                disabled={loading || !phone.trim()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  borderRadius: "1rem", padding: "14px 0", fontSize: 15, fontWeight: 800,
                  background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)",
                  color: "oklch(0.09 0.01 45)", opacity: (loading || !phone.trim()) ? 0.55 : 1,
                  transition: "opacity 0.2s",
                  cursor: (loading || !phone.trim()) ? "not-allowed" : "pointer",
                }}
                className="group"
              >
                {loading ? "Sending…" : "Send code"}
                {!loading && <ArrowRight size={17} style={{ transition: "transform 0.2s" }} />}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22 }}
              onSubmit={verifyOtp}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: "1rem", padding: "14px 16px", background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 11%)", cursor: "text" }}>
                <Shield size={17} style={{ color: "oklch(0.62 0.022 55)", flexShrink: 0 }} />
                <input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="· · · · · ·"
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setOtp(v);
                    if (boxState === "error") setBoxState("typing");
                    else setBoxState("typing");
                  }}
                  style={{ flex: 1, minWidth: 0, background: "transparent", fontSize: 20, letterSpacing: "0.5em", fontFamily: "monospace", outline: "none", color: "inherit" }}
                />
              </label>

              {/* Persistent fail prompt — appears after 3 wrong attempts */}
              <AnimatePresence>
                {failCount >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "0.875rem", padding: "12px 14px", background: "oklch(0.62 0.22 25 / 0.10)", border: "1px solid oklch(0.62 0.22 25 / 0.28)" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>Wrong code too many times?</p>
                        <p style={{ fontSize: 11, color: "oklch(0.62 0.022 55)", marginTop: 2 }}>We can send you a new one</p>
                      </div>
                      <button
                        type="button"
                        onClick={resendCode}
                        disabled={loading}
                        style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "7px 12px", background: "var(--gradient-primary)", color: "oklch(0.09 0.01 45)", fontSize: 12, fontWeight: 800, flexShrink: 0, minHeight: 36 }}
                      >
                        <RefreshCw size={12} />
                        New code
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  borderRadius: "1rem", padding: "14px 0", fontSize: 15, fontWeight: 800,
                  background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)",
                  color: "oklch(0.09 0.01 45)", opacity: (loading || otp.length < 4) ? 0.55 : 1,
                  transition: "opacity 0.2s",
                  cursor: (loading || otp.length < 4) ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Verifying…" : "Verify & enter Loop"}
                {!loading && <ArrowRight size={17} />}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setBoxState("typing"); setOtp(""); setFailCount(0); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, color: "oklch(0.60 0.022 55)", cursor: "pointer", minHeight: 36, background: "transparent", border: "none" }}
              >
                <ChevronLeft size={14} /> Use a different number
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p style={{ marginTop: 28, textAlign: "center", fontSize: 10, lineHeight: 1.7, color: "oklch(0.55 0.015 55)" }}>
          Continuing means you accept Loop's Terms & Privacy Policy.
        </p>
      </motion.div>

      {/* RALD badge */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "oklch(0.55 0.015 55)" }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "oklch(0.72 0.20 145)", animation: "breathe 4.5s ease-in-out infinite" }} />
        Protected by RALD Auth · End-to-end secured
      </motion.p>
    </div>
  );
}
