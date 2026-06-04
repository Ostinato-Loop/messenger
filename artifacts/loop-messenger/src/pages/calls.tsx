// Loop Messenger — Calls Page (Launch UI)
// Adopted from loop-messenger-ui-ux reference design.
// Adapted for Wouter router.
// LILCKY STUDIO LIMITED

import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Radio, Users } from "lucide-react";
import { calls, audioRooms } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function CallsPage() {
  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">Calls</h1>
          <p className="truncate text-xs text-muted-foreground">Voice, video, audio rooms</p>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground">
          <Video className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live audio rooms</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {audioRooms.map((r) => (
              <div
                key={r.id}
                className="flex w-64 shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      r.live ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground"
                    )}
                  >
                    <Radio className="h-3 w-3" /> {r.live ? "Live" : "Scheduled"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" /> {r.listeners}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">Hosted by {r.host}</p>
                <button className="mt-1 rounded-full bg-primary text-primary-foreground py-1.5 text-xs font-semibold">
                  {r.live ? "Join room" : "Remind me"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Phone className="h-4 w-4" />
            </button>
          </div>
          <ul className="divide-y divide-border/40">
            {calls.map((c) => {
              const Icon = c.direction === "missed" ? PhoneMissed : c.direction === "incoming" ? PhoneIncoming : PhoneOutgoing;
              return (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <img src={c.avatar} alt={c.name} className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-semibold", c.direction === "missed" && "text-destructive")}>
                      {c.name}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {c.direction} · {c.time}
                    </p>
                  </div>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted-foreground hover:text-foreground">
                    {c.type === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default CallsPage;
