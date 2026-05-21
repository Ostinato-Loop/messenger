import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useSendOtp, useVerifyOtp, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import loopLogo from "@assets/IMG_3832_1779368920403.jpeg";

const phoneSchema = z.object({
  phone: z.string().min(10, "Phone number is too short").max(15, "Phone number is too long"),
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
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const onPhoneSubmit = async (values: z.infer<typeof phoneSchema>) => {
    let formattedPhone = values.phone;
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+234" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+234" + formattedPhone;
    }

    setPhoneNumber(formattedPhone);

    sendOtp.mutate({ data: { phone: formattedPhone } }, {
      onSuccess: (res) => {
        setCooldown(res.cooldownSeconds || 60);
        setStep("otp");
        toast({ title: "OTP Sent", description: "Please check your messages." });
      },
      onError: (err) => {
        toast({ title: "Error", description: "Failed to send OTP. Please try again.", variant: "destructive" });
      }
    });
  };

  const onOtpSubmit = async (values: z.infer<typeof otpSchema>) => {
    verifyOtp.mutate({ data: { phone: phoneNumber, code: values.code } }, {
      onSuccess: (res) => {
        queryClient.setQueryData(getGetMeQueryKey(), res.user);
        if (res.isNewUser) {
          setLocation("/onboarding");
        } else {
          setLocation("/chats");
        }
      },
      onError: () => {
        toast({ title: "Invalid OTP", description: "The code you entered is incorrect.", variant: "destructive" });
      }
    });
  };

  const resendOtp = () => {
    if (cooldown > 0) return;
    sendOtp.mutate({ data: { phone: phoneNumber } }, {
      onSuccess: (res) => {
        setCooldown(res.cooldownSeconds || 60);
        toast({ title: "OTP Resent", description: "Please check your messages." });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10 space-y-8"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border border-primary/30 shadow-[0_0_30px_rgba(255,107,0,0.3)]">
            <img src={loopLogo} alt="Loop Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Loop Messenger</h1>
          <p className="text-muted-foreground">Secure. Fast. Futuristic.</p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Form {...phoneForm}>
                  <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
                    <FormField
                      control={phoneForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <Label className="text-muted-foreground">Phone Number</Label>
                          <div className="flex gap-2">
                            <div className="flex items-center justify-center bg-input/50 border border-border rounded-xl px-3 text-foreground font-mono text-sm">
                              +234
                            </div>
                            <FormControl>
                              <Input 
                                placeholder="801 234 5678" 
                                className="bg-input/50 border-border rounded-xl h-12 text-lg"
                                data-testid="input-phone"
                                {...field} 
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                      disabled={sendOtp.isPending}
                      data-testid="button-send-otp"
                    >
                      {sendOtp.isPending ? "Sending..." : "Continue"}
                    </Button>
                  </form>
                </Form>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex flex-col items-center"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Enter Verification Code</h2>
                  <p className="text-sm text-muted-foreground">We sent a 6-digit code to <br/><span className="text-primary font-mono">{phoneNumber}</span></p>
                </div>

                <Form {...otpForm}>
                  <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6 w-full flex flex-col items-center">
                    <FormField
                      control={otpForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem className="flex flex-col items-center">
                          <FormControl>
                            <InputOTP maxLength={6} {...field}>
                              <InputOTPGroup className="gap-2">
                                {[...Array(6)].map((_, i) => (
                                  <InputOTPSlot key={i} index={i} className="w-12 h-14 rounded-xl border-border bg-input/50 text-xl font-bold focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                                ))}
                              </InputOTPGroup>
                            </InputOTP>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                      disabled={verifyOtp.isPending || otpForm.watch("code").length !== 6}
                      data-testid="button-verify-otp"
                    >
                      {verifyOtp.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  </form>
                </Form>

                <Button 
                  variant="ghost" 
                  className="text-muted-foreground hover:text-primary"
                  onClick={resendOtp}
                  disabled={cooldown > 0 || sendOtp.isPending}
                  data-testid="button-resend-otp"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
                </Button>
                
                <Button 
                  variant="link" 
                  className="text-xs text-muted-foreground"
                  onClick={() => setStep("phone")}
                >
                  Change phone number
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
