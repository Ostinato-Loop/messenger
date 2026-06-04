// Loop Messenger — Communities Page
// Sprint 02 Trust & Retention: removed fake community cards from mock-data.
// Communities backend is not yet live. Honest empty state shown.
// No fake member counts. No fake activity indicators.
// LILCKY STUDIO LIMITED

import { useState } from "react";
import { Search, Plus, Clock, Bell, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const cats = ["All", "University", "Business", "Creator", "City", "Interest"] as const;

export default function CommunitiesPage() {
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const { toast } = useToast();

  const handleNotify = () => {
    toast({
      title: "You're on the list",
      description: "We'll notify you the moment communities go live.",
    });
  };

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">Communities</h1>
          <p className="truncate text-xs text-muted-foreground">Connect with people, brands, and ideas</p>
        </div>
        <button
          aria-label="Search communities"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
          onClick={() => toast({ title: "Search coming soon", description: "Community search is on its way." })}
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pt-3">
        {/* Category tabs — preview of upcoming community types */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Coming soon banner */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-surface p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Communities launching soon</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              University groups, city circles, creator collectives, and business networks are on their way.
              Join the waitlist to be first in.
            </p>
            <button
              onClick={handleNotify}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Bell className="h-3 w-3" /> Notify me when live
            </button>
          </div>
        </div>

        {/* Honest empty state — no fake communities */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/50 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <Users className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {cat === "All" ? "No communities yet" : `No ${cat} communities yet`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              Your communities will appear here once the backend launches.
            </p>
          </div>
        </div>

        {/* Create community — coming soon */}
        <button
          onClick={() => toast({ title: "Create a community", description: "Community creation is coming soon. We'll notify you when it's ready." })}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <Plus className="h-4 w-4" /> Create a community
        </button>
      </div>
    </div>
  );
}
