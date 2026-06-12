import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe({ query: { retry: false, staleTime: 60_000 } as any });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !me) {
      setLocation("/auth");
    }
  }, [me, isLoading, setLocation]);

  if (isLoading) return <Spinner />;
  if (!me) return null;
  return <>{children}</>;
}
