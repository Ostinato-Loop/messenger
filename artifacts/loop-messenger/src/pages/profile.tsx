import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetMe, useUpdateProfile, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User as UserIcon, Edit2, Save } from "lucide-react";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateProfile = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ displayName: "", bio: "", avatar: "" });

  React.useEffect(() => {
    if (me && !isEditing) {
      setFormData({
        displayName: me.displayName || "",
        bio: me.bio || "",
        avatar: me.avatar || ""
      });
    }
  }, [me, isEditing]);

  const handleSave = () => {
    updateProfile.mutate({ data: { displayName: formData.displayName, bio: formData.bio, avatar: formData.avatar } }, {
      onSuccess: (updatedUser) => {
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
        setIsEditing(false);
        toast({ title: "Profile updated" });
      }
    });
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-2xl bg-card border-x border-border min-h-screen">
        <div className="h-16 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-card/80 backdrop-blur z-10">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Profile</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="w-32 h-32 border-4 border-background shadow-[0_0_20px_rgba(255,107,0,0.2)]">
                <AvatarImage src={isEditing ? formData.avatar : me?.avatar || ""} />
                <AvatarFallback className="text-3xl"><UserIcon className="w-12 h-12 text-muted-foreground"/></AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer">
                  <Edit2 className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            
            {!isEditing ? (
              <div className="text-center space-y-1">
                <h2 className="text-3xl font-bold">{me?.displayName}</h2>
                <p className="text-primary font-mono">{me?.phone}</p>
                <p className="text-muted-foreground mt-4 max-w-md">{me?.bio || "No bio yet."}</p>
              </div>
            ) : null}
          </div>

          {isEditing ? (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="bg-input/50" />
              </div>
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input value={formData.avatar} onChange={e => setFormData({...formData, avatar: e.target.value})} className="bg-input/50" />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="bg-input/50 resize-none" rows={4} />
              </div>
              <div className="pt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave} disabled={updateProfile.isPending}>
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button variant="outline" className="w-full max-w-xs" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}