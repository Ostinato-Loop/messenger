import { supabase } from "@/integrations/supabase/client";
import type { Message } from "./useMessaging";

export type UploadedMedia = {
  publicUrl: string;
  mediaType: Extract<Message["type"], "image" | "audio" | "file">;
};

export async function uploadAttachment(
  chatId: string,
  file: File,
): Promise<UploadedMedia> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${chatId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("attachments").getPublicUrl(path);

  const mediaType: UploadedMedia["mediaType"] = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("audio/")
    ? "audio"
    : "file";

  return { publicUrl: data.publicUrl, mediaType };
}
