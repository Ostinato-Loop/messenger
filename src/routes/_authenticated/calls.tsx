import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";

export const Route = createFileRoute("/_authenticated/calls")({
  component: () => (
    <ComingSoonPanel
      title="Calls"
      subtitle="Voice & video, powered by LiveKit"
      icon={<PhoneCall size={28} />}
      hint="Premium 1:1 and group calls light up here once the LiveKit token service is connected."
    />
  ),
  ssr: false,
});
