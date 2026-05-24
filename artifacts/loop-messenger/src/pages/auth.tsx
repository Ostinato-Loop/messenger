import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.dial.includes(query) ||
      c.code.toLowerCase().includes(query.toLowerCase()),
  );

  const borderColor =
    raldState === "typing"  ? "#F59E0B" :
    raldState === "success" ? "#22C55E" :
    raldState === "error"   ? "#EF4444" :
    "hsl(var(--border))";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="flex h-11 items-center gap-1.5 rounded-xl border px-3 font-mono text-sm transition-all select-none"
        style={{
          background: "hsl(var(--input) / 0.5)",
          borderColor,
        }}
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="font-semibold">{selected.dial}</span>
        <ChevronDown
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onSelect(c); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50",
                      selected.code === c.code && "bg-primary/10 text-primary",
                    )}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">No results</li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const phoneSchema = z.object({
  phone: z.string().min(5, "Enter a valid phone number").max(15),
});

const otpSchema = z.object({
  code: z.string().length(6, "OTP must be 6 digits"),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [raldState, setRaldState] = useState<RaldState>("idle");

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [cooldown]);

  const watchedPhone = phoneForm.watch("phone");
  useEffect(() => {
    if (step === "phone") {
      if (sendOtp.isSuccess) return;
      setRaldState(watchedPhone.length > 0 ? "typing" : "idle");
    }
  }, [watchedPhone, step, sendOtp.isSuccess]);

  const watchedOtp = otpForm.watch("code");
  useEffect(() => {
    if (step === "otp") {
      if (verifyOtp.isSuccess || verifyOtp.isError) return;
      setRaldState(watchedOtp.length > 0 ? "typing" : "idle");
    }
  }, [watchedOtp, step, verifyOtp.isSuccess, verifyOtp.isError]);

  const buildE164 = useCallback(
    (local: string) => {
      const digits = local.replace(/\D/g, "");
      const stripped = digits.replace(/^0+/, "");
      return `${country.dial}${stripped}`;
    },
    [country],
  );

  const onPhoneSubmit = (values: z.infer<typeof phoneSchema>) => {
    const phone = buildE164(values.phone);
    setPhoneNumber(phone);

    sendOtp.mutate(
      { data: { phone } },
      {
        onSuccess: (res) => {
          setCooldown(res.cooldownSeconds || 60);
          setRaldState("success");
          setTimeout(() => { setStep("otp"); setRaldState("idle"); }, 600);
        },
        onError: () => {
          setRaldState("error");
          setTimeout(() => setRaldState("idle"), 1800);
          toast({ title: "Failed to send OTP", description: "Check your number and try again.", variant: "destructive" });
        },
      }
    );
  };

  const onOtpSubmit = (values: z.infer<typeof otpSchema>) => {
    verifyOtp.mutate(
      { data: { phone: phoneNumber, code: values.code } },
      {
        onSuccess: (res) => {
          setRaldState("success");
          queryClient.setQueryData(getGetMeQueryKey(), res.user);
          setTimeout(() => {
            if (res.isNewUser) setLocation("/onboarding");
            else setLocation("/chats");
          }, 500);
        },
        onError: () => {
          setRaldState("error");
          setTimeout(() => setRaldState("typing"), 1800);
          toast({ title: "Invalid code", description: "The code you entered is incorrect or expired.", variant: "destructive" });
        },
      }
    );
  };

  const resendOtp = () => {
    if (cooldown > 0) return;
    setRaldState("typing");
    sendOtp.mutate(
      { data: { phone: phoneNumber } },
      {
        onSuccess: (res) => {
          setCooldown(res.cooldownSeconds || 60);
          toast({ title: "OTP resent", description: "Check your messages." });
          setRaldState("idle");
        },
        onError: () => {
          setRaldState("error");
          setTimeout(() => setRaldState("idle"), 1800);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent pointer-events-none"
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 4, ease: "linear", repeat: Infinity, repeatDelay: 2 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm z-10 space-y-6"
      >
        <motion.div
          className="flex flex-col items-center space-y-3"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <div className="w-20 h-20 rounded-[22px] overflow-hidden border border-primary/30 shadow-[0_0_32px_rgba(255,107,0,0.3)]">
            <img src={loopLogo} alt="Loop Logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Loop Messenger</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Secure. Fast. Futuristic.</p>
          </div>
        </motion.div>

        <RaldFrame state={raldState}>
          <div className="bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-2xl">
            <AnimatePresence mode="wait">
              {step === "phone" ? (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold text-foreground">Enter your number</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">We'll send a verification code via SMS</p>
                  </div>

                  <Form {...phoneForm}>
                    <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                      <FormField
                        control={phoneForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <Label className="text-xs text-muted-foreground">Phone Number</Label>
                            <div className="flex gap-2">
                              <CountryPicker
                                selected={country}
                                onSelect={setCountry}
                                raldState={raldState}
                              />
                              <FormControl>
                                <Input
                                  placeholder="801 234 5678"
                                  className="bg-input/50 rounded-xl h-11 text-base transition-all"
                                  style={{
                                    borderColor: raldState === "typing" ? "#F59E0B"
                                               : raldState === "success" ? "#22C55E"
                                               : raldState === "error"   ? "#EF4444"
                                               : undefined,
                                    boxShadow: raldState === "typing" ? "0 0 0 1px #F59E0B40"
                                             : raldState === "success" ? "0 0 0 1px #22C55E40"
                                             : raldState === "error"   ? "0 0 0 1px #EF444440"
                                             : undefined,
                                  }}
                                  inputMode="tel"
                                  data-testid="input-phone"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <HeartbeatButton
                        onClick={phoneForm.handleSubmit(onPhoneSubmit)}
                        loading={sendOtp.isPending}
                        disabled={!watchedPhone || sendOtp.isPending}
                        data-testid="button-send-otp"
                      >
                        Continue
                      </HeartbeatButton>
                    </form>
                  </Form>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 flex flex-col items-center"
                >
                  <div className="text-center space-y-1 w-full">
                    <h2 className="text-lg font-semibold">Verification Code</h2>
                    <p className="text-xs text-muted-foreground">
                      Sent to <span className="text-primary font-mono">{phoneNumber}</span>
                    </p>
                  </div>

                  <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-5 w-full flex flex-col items-center">
                      <FormField
                        control={otpForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem className="flex flex-col items-center">
                            <FormControl>
                              <InputOTP maxLength={6} {...field} data-testid="input-otp">
                                <InputOTPGroup className="gap-2">
                                  {[...Array(6)].map((_, i) => (
                                    <InputOTPSlot
                                      key={i}
                                      index={i}
                                      className="w-11 h-13 rounded-xl bg-input/50 text-xl font-bold transition-all"
                                      style={{
                                        borderColor: raldState === "typing" ? "#F59E0B"
                                                   : raldState === "success" ? "#22C55E"
                                                   : raldState === "error"   ? "#EF4444"
                                                   : undefined,
                                      }}
                                    />
                                  ))}
                                </InputOTPGroup>
                              </InputOTP>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <HeartbeatButton
                        onClick={otpForm.handleSubmit(onOtpSubmit)}
                        loading={verifyOtp.isPending}
                        disabled={watchedOtp.length !== 6 || verifyOtp.isPending}
                        data-testid="button-verify-otp"
                      >
                        Verify & Continue
                      </HeartbeatButton>
                    </form>
                  </Form>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                      onClick={resendOtp}
                      disabled={cooldown > 0 || sendOtp.isPending}
                      data-testid="button-resend-otp"
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      onClick={() => { setStep("phone"); setRaldState("idle"); otpForm.reset(); }}
                    >
                      Change number
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </RaldFrame>

        <p className="text-center text-[10px] text-muted-foreground/60 px-4">
          By continuing, you agree to our{" "}
          <button
            type="button"
            className="underline hover:text-primary transition-colors"
            onClick={() => setLocation("/terms")}
          >
            Terms & Conditions
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="underline hover:text-primary transition-colors"
            onClick={() => setLocation("/terms")}
          >
            Privacy Policy
          </button>
          .
          <br />
          © Lilcky Studio Limited
        </p>
      </motion.div>
    </div>
  );
}
