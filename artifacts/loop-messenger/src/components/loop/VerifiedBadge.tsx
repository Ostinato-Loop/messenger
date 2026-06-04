import { BadgeCheck, Briefcase } from "lucide-react";

export function VerifiedBadge() {
  return (
    <BadgeCheck
      className="h-3.5 w-3.5 shrink-0 text-primary"
      aria-label="Verified"
    />
  );
}

export function BusinessBadge() {
  return (
    <Briefcase
      className="h-3 w-3 shrink-0 text-amber-400"
      aria-label="Business"
    />
  );
}
