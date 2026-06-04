interface LoopAvatarProps {
  src?: string | null;
  alt: string;
  online?: boolean;
  size?: number;
}

export function LoopAvatar({ src, alt, online, size = 44 }: LoopAvatarProps) {
  const initials = alt
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-bold"
          style={{ width: size, height: size, fontSize: size * 0.32 }}
        >
          {initials}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-emerald-500"
          style={{ width: size * 0.27, height: size * 0.27 }}
        />
      )}
    </div>
  );
}
