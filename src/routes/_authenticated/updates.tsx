import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export const Route = createFileRoute("/_authenticated/updates")({
  component: () => (
    <ComingSoonPanel
      title="Updates"
      subtitle="Status, stories, and signals from your circle"
      icon={<Sparkles size={28} />}
      hint="Ephemeral updates and ambient activity from your contacts will surface here."
    />
  ),
  ssr: false,
});
