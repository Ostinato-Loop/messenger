interface LoopLogoProps {
  withWord?: boolean;
  size?: number;
}

export function LoopLogo({ withWord, size = 28 }: LoopLogoProps) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-black"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden
      >
        L
      </span>
      {withWord && (
        <span className="font-display font-extrabold text-foreground" style={{ fontSize: size * 0.64 }}>
          Messenger
        </span>
      )}
    </span>
  );
}
