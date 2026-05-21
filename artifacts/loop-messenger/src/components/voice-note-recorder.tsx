import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, X } from "lucide-react";
import { voiceProvider, blobToDataUrl, formatDuration } from "@/lib/trtc-client";

interface VoiceNoteRecorderProps {
  onSend: (dataUrl: string, durationSeconds: number) => void;
  onCancel: () => void;
  disabled?: boolean;
  autoStart?: boolean;
}

export function VoiceNoteRecorder({ onSend, onCancel, disabled, autoStart }: VoiceNoteRecorderProps) {
  const [phase, setPhase] = useState<"idle" | "recording" | "preview">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => { clearTimer(); }, []);

  useEffect(() => {
    if (autoStart && phase === "idle") {
      startRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const startRecording = async () => {
    setError(null);
    try {
      await voiceProvider.startRecording();
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow mic in browser settings.");
    }
  };

  const stopRecording = async () => {
    clearTimer();
    try {
      const blob = await voiceProvider.stopRecording();
      const dataUrl = await blobToDataUrl(blob);
      blobRef.current = dataUrl;
      setAudioUrl(dataUrl);
      setAudioDuration(elapsed);
      setPhase("preview");
    } catch {
      setError("Failed to capture voice note.");
      setPhase("idle");
    }
  };

  const handleSend = () => {
    if (blobRef.current) {
      onSend(blobRef.current, audioDuration);
      reset();
    }
  };

  const reset = () => {
    clearTimer();
    setPhase("idle");
    setElapsed(0);
    setAudioUrl(null);
    setAudioDuration(0);
    blobRef.current = null;
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-2xl text-xs text-destructive">
        <MicOff className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
        <button onClick={handleCancel} className="ml-auto"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" && (
        <motion.button
          key="idle"
          type="button"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={startRecording}
          disabled={disabled}
          className="w-10 h-10 rounded-full bg-muted/50 hover:bg-primary/20 border border-border hover:border-primary/40 flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <Mic className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      )}

      {phase === "recording" && (
        <motion.div
          key="recording"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-3 flex-1 bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-2"
        >
          {/* Animated waveform */}
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-destructive"
                animate={{ height: ["6px", `${10 + i * 4}px`, "6px"] }}
                transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1">
            <motion.div
              className="w-2 h-2 rounded-full bg-destructive"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="font-mono text-sm text-destructive font-medium">
              {formatDuration(elapsed)}
            </span>
            <span className="text-xs text-muted-foreground">Recording…</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(255,107,0,0.5)] hover:bg-primary/90 transition-colors"
            >
              <div className="w-3 h-3 rounded-sm bg-white" />
            </button>
          </div>
        </motion.div>
      )}

      {phase === "preview" && audioUrl && (
        <motion.div
          key="preview"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-3 flex-1 bg-card/80 border border-border rounded-2xl px-4 py-2"
        >
          <audio
            src={audioUrl}
            controls
            className="h-8 flex-1"
            style={{ colorScheme: "dark" }}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
            {formatDuration(audioDuration)}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(255,107,0,0.5)] hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Compact audio message bubble for playback in chat */
export function AudioMessage({ src, duration }: { src: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-3 min-w-[180px] max-w-[240px]">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setCurrentTime(a.currentTime);
          setProgress(a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setTotalDuration(a.duration);
        }}
        preload="metadata"
      />

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition-colors"
      >
        {playing ? (
          <div className="flex gap-0.5">
            <div className="w-1 h-3.5 bg-white rounded-full" />
            <div className="w-1 h-3.5 bg-white rounded-full" />
          </div>
        ) : (
          <div
            className="w-0 h-0 ml-0.5"
            style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid white" }}
          />
        )}
      </button>

      {/* Waveform / progress bar */}
      <div className="flex-1 space-y-1">
        <div className="relative h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-white/80 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-white/60 font-mono">
          {playing ? formatDuration(currentTime) : formatDuration(totalDuration)}
        </span>
      </div>
    </div>
  );
}
