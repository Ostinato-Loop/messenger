// Loop Messenger — Calls Page
// Sprint 02 Trust & Retention: removed fake call history and audio rooms from mock-data.
// Calls backend and call history API are not yet live. Honest empty states shown.
// No fake names, no fake listener counts, no fake call history.
// LILCKY STUDIO LIMITED

import { Phone, Video, Radio, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CallsPage() {
  const { toast } = useToast();

  const handleNewCall = () => {
    toast({
      title: "Start a call",
      description: "Select a conversation from Chats and tap the call button to start a voice or video call.",
    });
  };

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">Calls</h1>
          <p className="truncate text-xs text-muted-foreground">Voice, video, audio rooms</p>
        </div>
        <button
          onClick={handleNewCall}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
          aria-label="New call"
        >
          <Video className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Live audio rooms — honest empty state (rooms come from Loop API) */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live audio rooms
          </h2>
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/50 px-6 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <Radio className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold">No live rooms right now</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open Loop to browse and join audio rooms.
              </p>
            </div>
          </div>
        </section>

        {/* Call history — honest empty state */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </h2>
            <button
              onClick={handleNewCall}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label="New call"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/50 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <PhoneOff className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold">No call history yet</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                Your voice and video calls will appear here after your first call.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CallsPage;
