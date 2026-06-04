import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { MessageSquare, Phone, Compass, User } from "lucide-react";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
  { to: "/chats",     label: "Chats",   icon: MessageSquare },
  { to: "/calls",     label: "Calls",   icon: Phone },
  { to: "/discover",  label: "Discover",icon: Compass },
  { to: "/profile",   label: "You",     icon: User },
] as const;

interface MobileShellProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function MobileShell({ children, hideNav }: MobileShellProps) {
  const [location, setLocation] = useLocation();
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <main className={cn("flex-1 overflow-y-auto", !hideNav && "pb-20")}>
        {children}
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl safe-pb">
          <ul className="flex h-16 items-center justify-around px-4">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = location === to || location.startsWith(to + "/");
              return (
                <li key={to}>
                  <button
                    onClick={() => setLocation(to)}
                    className="flex flex-col items-center justify-center gap-0.5"
                  >
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px] transition-colors",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    <span className={cn(
                      "text-[10px] transition-colors",
                      active ? "text-foreground font-semibold" : "text-muted-foreground",
                    )}>
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
