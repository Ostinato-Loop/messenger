// Loop Messenger — Communities Page (Launch UI)
// Adopted from loop-messenger-ui-ux reference design.
// Adapted for Wouter router.
// Communities backend is coming soon — UI shows real launch state, not fake join buttons.
// LILCKY STUDIO LIMITED

import { useState } from "react";
import { Search, Plus, Sparkles, Users, Clock, Bell } from "lucide-react";
import { communities } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const cats = ["All", "University", "Business", "Creator", "City", "Interest"] as const;

function activityColor(level: "high" | "medium" | "low") {
  return level === "high"
    ? "#22c55e"
    : level === "medium"
    ? "var(--primary, #00FF88)"
    : "var(--muted-foreground, #999)";
}

export default function CommunitiesPage() {
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const { toast } = useToast();
  const list = communities.filter((c) => cat === "All" || c.category === cat);

  const handleJoin = (name: string) => {
    toast({
      title: "Communities launching soon",
      description: `${name} and thousands more communities are coming. You'll be notified when they open.`,
    });
  };

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

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-surface p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Communities launching soon</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Browse what's coming. Join lists open — you'll be invited when your communities go live.
            </p>
            <button
              onClick={handleNotify}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Bell className="h-3 w-3" /> Notify me when live
            </button>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discover</h2>
            <span className="flex items-center gap-1 text-[11px] text-primary">
              <Sparkles className="h-3 w-3" /> For you
            </span>
          </div>

          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border/60 bg-surface p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="h-12 w-12 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      {c.verified && <span className="text-primary text-xs">✓</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      <Users className="inline h-2.5 w-2.5 mr-0.5" />
                      {c.members.toLocaleString()} members ·{" "}
                      <span style={{ color: activityColor(c.activity) }}>
                        ● {c.activity} activity
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoin(c.name)}
                    className="shrink-0 rounded-full bg-surface border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    + Join list
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
              </li>
            ))}
          </ul>
        </section>

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
