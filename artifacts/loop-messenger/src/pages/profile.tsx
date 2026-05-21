import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetMe, useUpdateProfile, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit2, Save, LogOut, Shield } from "lucide-react";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ displayName: "", bio: "", avatar: "" });

  React.useEffect(() => {
    if (me && !isEditing) {
      setFormData({ displayName: me.displayName || "", bio: me.bio || "", avatar: me.avatar || "" });
    }
  }, [me, isEditing]);

  const handleSave = () => {
    updateProfile.mutate(
      { data: { displayName: formData.displayName, bio: formData.bio || null, avatar: formData.avatar || null } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          setIsEditing(false);
          toast({ title: "Profile updated" });
        },
        onError: () => toast({ title: "Error", description: "Failed to update profile", variant: "destructive" }),
      }
    );
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/auth"); },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-2xl bg-card border-x border-border min-h-screen">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-card/90 backdrop-blur z-10">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chats")} data-testid="button-back-profile">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Profile</h1>
          {!isEditing ? (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
              <Edit2 className="w-4 h-4 mr-1" /> Edit
            </Button>
          ) : (
            <Button size="sm" className="rounded-xl bg-primary text-white h-8" onClick={handleSave} disabled={updateProfile.isPending} data-testid="button-save-profile">
              <Save className="w-4 h-4 mr-1" /> {updateProfile.isPending ? "Saving..." : "Save"}
            </Button>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center space-y-4 pt-2">
            <div className="relative">
              <Avatar className="w-28 h-28 border-2 border-primary/30 shadow-[0_0_24px_rgba(255,107,0,0.2)]">
                <AvatarImage src={isEditing ? formData.avatar : me?.avatar || ""} />
                <AvatarFallback className="text-2xl bg-card text-primary font-bold">
                  {me?.displayName?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {!isEditing && (
              <div className="text-center">
                <h2 className="text-2xl font-bold">{me?.displayName}</h2>
                <p className="text-primary font-mono text-sm mt-0.5">{me?.phone}</p>
                {me?.bio && <p className="text-muted-foreground text-sm mt-2 max-w-xs">{me.bio}</p>}
              </div>
            )}
          </div>

          {/* Edit form */}
          {isEditing && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display Name</Label>
                <Input value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} className="bg-input/50 rounded-xl h-11" data-testid="input-display-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Avatar URL</Label>
                <Input value={formData.avatar} onChange={e => setFormData({ ...formData, avatar: e.target.value })} placeholder="https://..." className="bg-input/50 rounded-xl h-11" data-testid="input-avatar" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bio</Label>
                <Textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder="Tell people about yourself..." className="bg-input/50 resize-none" rows={3} data-testid="input-bio" />
              </div>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          )}

          {/* Info card */}
          <div className="bg-background/50 border border-border rounded-2xl divide-y divide-border">
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Phone</span>
              <span className="font-mono text-sm">{me?.phone}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Member since</span>
              <span className="text-sm">{me?.createdAt ? new Date(me.createdAt).toLocaleDateString("en-NG") : "—"}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]" />
                <span className="text-sm text-green-400">Online</span>
              </div>
            </div>
          </div>

          {/* Legal + logout */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setLocation("/terms")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border hover:bg-muted/30 transition-colors text-sm text-muted-foreground"
              data-testid="button-terms"
            >
              <Shield className="w-4 h-4 text-primary" />
              Terms & Privacy Policy
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              {logout.isPending ? "Signing out..." : "Sign Out"}
            </button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/40 pb-4">
            Loop Messenger · © Lilcky Studio Limited
          </p>
        </motion.div>
      </div>
    </div>
  );
}
