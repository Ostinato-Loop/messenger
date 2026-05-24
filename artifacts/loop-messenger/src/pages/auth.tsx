import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
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

type RaldState = "idle" | "typing" | "success" | "error";

const phoneSchema = z.object({
  phone: z.string().min(8, "Enter a valid phone number").max(15),
});

const otpSchema = z.object({
  code: z.string().length(6, "OTP must be 6 digits"),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"phone" | "otp">("phone");
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

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [cooldown]);

  // Watch phone input → amber when typing
  const watchedPhone = phoneForm.watch("phone");
  useEffect(() => {
    if (step === "phone") {
      if (sendOtp.isSuccess) return;
      setRaldState(watchedPhone.length > 0 ? "typing" : "idle");
    }
  }, [watchedPhone, step, sendOtp.isSuccess]);

  // Watch OTP input → amber when typing
  const watchedOtp = otpForm.watch("code");
  useEffect(() => {
    if (step === "otp") {
      if (verifyOtp.isSuccess || verifyOtp.isError) return;
      setRaldState(watchedOtp.length > 0 ? "typing" : "idle");
    }
  }, [watchedOtp, step, verifyOtp.isSuccess, verifyOtp.isError]);

  const onPhoneSubmit = (values: z.infer<typeof phoneSchema>) => {
    let phone = values.phone;
    if (phone.startsWith("0") && phone.length <= 11) phone = "+234" + phone.slice(1);
    else if (!phone.startsWith("+")) phone = "+234" + phone;
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
      {/* Background radial glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Scan line */}
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
        {/* Logo */}
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

        {/* Card with RALD frame */}
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
                              <div
                                className="flex items-center justify-center border rounded-xl px-3 font-mono text-sm select-none transition-colors"
                                style={{
                                  background: "hsl(var(--input) / 0.5)",
                                  borderColor: raldState === "typing" ? "#F59E0B"
                                             : raldState === "success" ? "#22C55E"
                                             : raldState === "error"   ? "#EF4444"
                                             : "hsl(var(--border))",
                                }}
                              >
                                <span className="mr-1">🇳🇬</span> +234
                              </div>
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

        {/* Terms link */}
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
