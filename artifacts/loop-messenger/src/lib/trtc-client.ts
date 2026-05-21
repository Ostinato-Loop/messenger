/**
 * Tencent TRTC Client — Provider Abstraction Layer (V1)
 *
 * V1 usage: Voice note infrastructure + token management
 * V2 usage: Full voice/video calls using TRTC SDK
 *
 * The TRTC SDK (trtc-js-sdk) is loaded lazily from CDN so it doesn't
 * add to the initial bundle — critical for African 3G/4G performance.
 */

export interface RTCToken {
  sdkAppId: number;
  userId: string;
  userSig: string;
  roomId: string;
  expireAt: number;
}

export interface RTCStatus {
  configured: boolean;
  sdkAppId: number | null;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "";

/** Check if TRTC is configured on the backend */
export async function getRTCStatus(): Promise<RTCStatus> {
  const res = await fetch(`${API_BASE}/api/rtc/status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to get RTC status");
  return res.json() as Promise<RTCStatus>;
}

/** Generate a TRTC token for a room */
export async function getRTCToken(roomId: string): Promise<RTCToken> {
  const res = await fetch(`${API_BASE}/api/rtc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ roomId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? "Failed to get RTC token");
  }
  return res.json() as Promise<RTCToken>;
}

/**
 * Communication Provider Interface
 * All real-time communication goes through this abstraction so Tencent
 * can later be swapped for proprietary RALD infrastructure without
 * touching any business logic.
 */
export interface IVoiceProvider {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  isRecording(): boolean;
}

export interface ICallProvider {
  joinRoom(token: RTCToken): Promise<void>;
  leaveRoom(): Promise<void>;
  muteAudio(muted: boolean): void;
  muteVideo(muted: boolean): void;
}

/**
 * BrowserVoiceProvider — MediaRecorder-based voice note recording
 * (Used in V1 for voice notes; TRTC SDK used for calls in V2)
 */
export class BrowserVoiceProvider implements IVoiceProvider {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobEvent["data"][] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : "audio/webm";

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(200);
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error("Not recording"));
        return;
      }
      this.recorder.onstop = () => {
        const mimeType = this.recorder?.mimeType ?? "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === "recording";
  }
}

/** Singleton voice provider instance */
export const voiceProvider = new BrowserVoiceProvider();

/** Convert a Blob to a base64 data URL for inline storage */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Format voice note duration */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
