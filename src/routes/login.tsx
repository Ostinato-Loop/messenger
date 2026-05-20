import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Phone, ShieldCheck } from "lucide-react";

import { LoopMark } from "@/components/LoopMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  ssr: false,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, hydrated } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hydrated || !session) return;
    navigate({
      to: profile?.onboarding_completed ? "/chats" : "/onboarding",
      replace: true,
    });
  }, [hydrated, session, profile, navigate]);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  const cleanedPhone = () => {
    const p = phone.trim();
    return p.startsWith("+") ? p : `+${p.replace(/\D/g, "")}`;
  };

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: cleanedPhone(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification code sent via RALD");
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: cleanedPhone(),
      token: otp.trim(),
      type: "sms",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome to Loop");
  }

  return (
    <div className="relative flex min-h-screen flex-col px-6 py-10 safe-top safe-bottom">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl animate-breathe" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-3 pt-8"
      >
        <LoopMark size={72} />
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-gradient-purple">Loop</span> Messenger
        </h1>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {step === "phone" ? "Sign in with your phone" : "Verify your number"}
        </p>
      </motion.div>

      <motion.form
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={step === "phone" ? sendOtp : verifyOtp}
        className="mx-auto mt-12 flex w-full max-w-sm flex-col gap-4"
      >
        {step === "phone" ? (
          <label className="glass-raised flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:glow-ring transition-all">
            <Phone size={18} className="text-muted-foreground" />
            <input
              ref={phoneRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
          </label>
        ) : (
          <label className="glass-raised flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:glow-ring transition-all">
            <ShieldCheck size={18} className="text-muted-foreground" />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="flex-1 bg-transparent text-base tracking-[0.4em] text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group mt-2 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          style={{
            background: "var(--gradient-purple)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          {loading
            ? "Please wait…"
            : step === "phone"
              ? "Send code"
              : "Verify & continue"}
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>

        {step === "otp" && (
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setOtp("");
            }}
            className="mt-1 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Use a different number
          </button>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/80">
          By continuing you agree to Loop's Terms &amp; Privacy.
          <br />
          <span className="text-primary/70">🔒 Protected by RALD Auth</span>
          {" · "}A LILCKY STUDIO product.
        </p>
      </motion.form>
    </div>
  );
}
