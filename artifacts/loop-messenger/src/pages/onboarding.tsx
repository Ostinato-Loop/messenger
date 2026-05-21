import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useUpdateProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { User } from "lucide-react";

const onboardingSchema = z.object({
  displayName: z.string().min(2, "Display name is required").max(50),
  avatar: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const { data: user } = useGetMe();

  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { 
      displayName: "",
      avatar: "",
    },
  });

  const onSubmit = (values: z.infer<typeof onboardingSchema>) => {
    updateProfile.mutate({ data: { displayName: values.displayName, avatar: values.avatar || null } }, {
      onSuccess: (updatedUser) => {
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
        toast({ title: "Profile created", description: "Welcome to Loop Messenger" });
        setLocation("/chats");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Set up profile</h1>
            <p className="text-muted-foreground">How should people identify you?</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full bg-input/50 border-2 border-primary border-dashed flex items-center justify-center overflow-hidden">
                  {form.watch("avatar") ? (
                    <img src={form.watch("avatar")} alt="Avatar preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-muted-foreground">Display Name</Label>
                    <FormControl>
                      <Input 
                        placeholder="Cyber Ninja" 
                        className="bg-input/50 border-border rounded-xl h-12 text-lg"
                        data-testid="input-display-name"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-muted-foreground">Avatar URL (optional)</Label>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/avatar.png" 
                        className="bg-input/50 border-border rounded-xl h-12"
                        data-testid="input-avatar-url"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                disabled={updateProfile.isPending}
                data-testid="button-complete-onboarding"
              >
                {updateProfile.isPending ? "Saving..." : "Start Chatting"}
              </Button>
            </form>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
