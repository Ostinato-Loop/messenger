import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, LogIn } from "lucide-react";
import { useSendOtp, useVerifyOtp, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { RaldFrame } from "@/components/rald-box";
import { HeartbeatButton } from "@/components/heartbeat-button";
import loopLogo from "@assets/IMG_3832_1779603911915.jpeg";
import { cn } from "@/lib/utils";

const MESSENGER_TOKEN_KEY = "messenger_rald_token";
const RALD_AUTH_UI        = "https://accounts.rald.cloud";
const API_BASE            = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

type RaldState = "idle" | "typing" | "success" | "error";

type Country = { code: string; flag: string; name: string; dial: string };

const COUNTRIES: Country[] = [
  { code: "NG", flag: "🇳🇬", name: "Nigeria",           dial: "+234" },
  { code: "KE", flag: "🇰🇪", name: "Kenya",             dial: "+254" },
  { code: "GH", flag: "🇬🇭", name: "Ghana",             dial: "+233" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa",      dial: "+27"  },
  { code: "ET", flag: "🇪🇹", name: "Ethiopia",          dial: "+251" },
  { code: "TZ", flag: "🇹🇿", name: "Tanzania",          dial: "+255" },
  { code: "UG", flag: "🇺🇬", name: "Uganda",            dial: "+256" },
  { code: "RW", flag: "🇷🇼", name: "Rwanda",            dial: "+250" },
  { code: "SN", flag: "🇸🇳", name: "Senegal",           dial: "+221" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire",     dial: "+225" },
  { code: "CM", flag: "🇨🇲", name: "Cameroon",          dial: "+237" },
  { code: "EG", flag: "🇪🇬", name: "Egypt",             dial: "+20"  },
  { code: "MA", flag: "🇲🇦", name: "Morocco",           dial: "+212" },
  { code: "TN", flag: "🇹🇳", name: "Tunisia",           dial: "+216" },
  { code: "ZW", flag: "🇿🇼", name: "Zimbabwe",          dial: "+263" },
  { code: "ZM", flag: "🇿🇲", name: "Zambia",            dial: "+260" },
  { code: "AO", flag: "🇦🇴", name: "Angola",            dial: "+244" },
  { code: "MZ", flag: "🇲🇿", name: "Mozambique",        dial: "+258" },
  { code: "MG", flag: "🇲🇬", name: "Madagascar",        dial: "+261" },
  { code: "CD", flag: "🇨🇩", name: "DR Congo",          dial: "+243" },
  { code: "BW", flag: "🇧🇼", name: "Botswana",          dial: "+267" },
  { code: "NA", flag: "🇳🇦", name: "Namibia",           dial: "+264" },
  { code: "SS", flag: "🇸🇸", name: "South Sudan",       dial: "+211" },
  { code: "SO", flag: "🇸🇴", name: "Somalia",           dial: "+252" },
  { code: "ML", flag: "🇲🇱", name: "Mali",              dial: "+223" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso",      dial: "+226" },
  { code: "NE", flag: "🇳🇪", name: "Niger",             dial: "+227" },
  { code: "TD", flag: "🇹🇩", name: "Chad",              dial: "+235" },
  { code: "GM", flag: "🇬🇲", name: "Gambia",            dial: "+220" },
  { code: "SL", flag: "🇸🇱", name: "Sierra Leone",      dial: "+232" },
  { code: "LR", flag: "🇱🇷", name: "Liberia",           dial: "+231" },
  { code: "MU", flag: "🇲🇺", name: "Mauritius",         dial: "+230" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom",    dial: "+44"  },
  { code: "US", flag: "🇺🇸", name: "United States",     dial: "+1"   },
];

function CountryPicker({
  selected, onSelect, raldState,
}: {
  selected: Country;
  onSelect: (c: Country) => void;
  raldState: RaldState;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.dial.includes(query)
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors",
          "bg-white/5 border-white/10 hover:bg-white/10 text-white",
          raldState === "typing" && "border-amber-400/60",
        )}
      >
        <span className="text-lg">{selected.flag}</span>
        <span className="text-white/70">{selected.dial}</span>
        <ChevronDown className="w-3.5 h-3.5 text-white/50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full mt-1 left-0 z-50 w-64 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-white/10">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
                <Search className="w-3.5 h-3.5 text-white/40" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search country..."
                  className="bg-transparent text-sm text-white placeholder-white/30 outline-none flex-1"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onSelect(c); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 text-sm text-white transition-colors"
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="flex-1 text-left">{c.name}</span>
                  <span className="text-white/40 text-xs">{c.dial}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const phoneSchema = z.object({ phone: z.string().min(6, "Enter a valid phone number") });
const otpSchema   = z.object({ otp:   z.string().length(6, "Enter 6-digit code") });
type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm   = z.infer<typeof otpSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const [country,   setCountry]   = useState<Country>(COUNTRIES[0]);
  const [step,      setStep]      = useState<"phone" | "otp">("phone");
  const [fullPhone, setFullPhone] = useState("");
  const [raldState, setRaldState] = useState<RaldState>("idle");
  const [ssoLoading, setSsoLoading] = useState(false);

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) });
  const otpForm   = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  const sendOtp   = useSendOtp();
  const verifyOtp = useVerifyOtp();

  // ── RALD SSO callback — fires on mount if arriving from Loop or RALD Auth ──
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const raldToken = params.get("rald_token");
    const appId     = params.get("app_id");

    if (!raldToken || (appId && appId !== "messenger")) return;

    setSsoLoading(true);

    fetch(`${API_BASE}/auth/rald-sso`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rald_token: raldToken }),
    })
      .then(res => {
        if (!res.ok) throw new Error("RALD SSO rejected");
        return res.json() as Promise<{ authenticated: boolean; user: { id: string } }>;
      })
      .then(() => {
        // Store the RALD JWT — it IS the Bearer token for the Messenger API
        localStorage.setItem(MESSENGER_TOKEN_KEY, raldToken);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        // Invalidate user cache so useGetMe re-fetches with the new token
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/chats");
      })
      .catch(() => {
        toast({ title: "Sign-in failed", description: "Your session link has expired. Please sign in again.", variant: "destructive" });
        setSsoLoading(false);
      });
  }, [queryClient, setLocation, toast]);

  const onPhoneSubmit = useCallback(async (values: PhoneForm) => {
    const phone = `${country.dial}${values.phone.replace(/^0/, "")}`;
    setFullPhone(phone);
    setRaldState("typing");
    try {
      await sendOtp.mutateAsync({ data: { phone } });
      setStep("otp");
      setRaldState("idle");
    } catch {
      setRaldState("error");
      toast({ title: "Failed to send OTP", description: "Check your number and try again.", variant: "destructive" });
    }
  }, [country, sendOtp, toast]);

  const onOtpSubmit = useCallback(async (values: OtpForm) => {
    setRaldState("typing");
    try {
      const result = await verifyOtp.mutateAsync({ data: { phone: fullPhone, code: values.otp } });
      if ((result as any)?.token) {
        localStorage.setItem(MESSENGER_TOKEN_KEY, (result as any).token);
      }
      setRaldState("success");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setTimeout(() => setLocation("/chats"), 300);
    } catch {
      setRaldState("error");
      toast({ title: "Invalid code", description: "Check the code and try again.", variant: "destructive" });
    }
  }, [fullPhone, verifyOtp, queryClient, setLocation, toast]);

  // ── RALD SSO sign-in button ────────────────────────────────────────────────
  const handleRaldSignIn = useCallback(() => {
    const redirectTo = encodeURIComponent("https://messenger.rald.cloud/auth");
    window.location.href = `${RALD_AUTH_UI}?redirect_to=${redirectTo}&app_id=messenger`;
  }, []);

  if (ssoLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-white/60 text-sm">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={loopLogo} alt="RALD" className="w-16 h-16 rounded-2xl object-cover" />
        </div>

        <RaldFrame raldState={raldState} className="p-6 rounded-2xl">
          <h1 className="text-xl font-semibold text-white text-center mb-1">
            {step === "phone" ? "Sign in to Messenger" : "Enter your code"}
          </h1>
          <p className="text-white/50 text-sm text-center mb-6">
            {step === "phone"
              ? "We'll send a verification code to your phone"
              : `Sent to ${fullPhone}`}
          </p>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Form {...phoneForm}>
                  <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                    <FormField
                      control={phoneForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <Label className="text-white/70 text-xs">Phone number</Label>
                          <FormControl>
                            <div className="flex gap-2">
                              <CountryPicker selected={country} onSelect={setCountry} raldState={raldState} />
                              <Input
                                {...field}
                                type="tel"
                                placeholder="8012345678"
                                onFocus={() => setRaldState("typing")}
                                onBlur={() => setRaldState("idle")}
                                className="flex-1 bg-white/5 border-white/10 text-white placeholder-white/30"
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />
                    <HeartbeatButton
                      type="submit"
                      disabled={sendOtp.isPending}
                      className="w-full"
                      raldState={raldState}
                    >
                      {sendOtp.isPending ? "Sending..." : "Send code"}
                    </HeartbeatButton>
                  </form>
                </Form>

                {/* RALD SSO divider + button */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={handleRaldSignIn}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-sm transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Continue with RALD account
                </button>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Form {...otpForm}>
                  <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                    <FormField
                      control={otpForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <Label className="text-white/70 text-xs">6-digit code</Label>
                          <FormControl>
                            <InputOTP maxLength={6} {...field} className="justify-center">
                              <InputOTPGroup>
                                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                              </InputOTPGroup>
                            </InputOTP>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />
                    <HeartbeatButton
                      type="submit"
                      disabled={verifyOtp.isPending}
                      className="w-full"
                      raldState={raldState}
                    >
                      {verifyOtp.isPending ? "Verifying..." : "Verify"}
                    </HeartbeatButton>
                  </form>
                </Form>
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setRaldState("idle"); otpForm.reset(); }}
                  className="mt-3 w-full text-center text-white/40 text-xs hover:text-white/70 transition-colors"
                >
                  Use a different number
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </RaldFrame>
      </motion.div>
    </div>
  );
}
