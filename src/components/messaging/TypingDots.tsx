import { motion } from "framer-motion";

export function TypingDots({ small = false }: { small?: boolean }) {
  const size = small ? 4 : 6;
  return (
    <div className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block rounded-full bg-current"
          style={{ width: size, height: size }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
