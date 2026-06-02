// Loop Messenger — Audit log helper
// LILCKY STUDIO LIMITED

import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  workspaceId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(db: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await db.from("messenger_audit_log").insert({
      workspace_id:  entry.workspaceId,
      actor_id:      entry.actorId,
      action:        entry.action,
      resource_type: entry.resourceType,
      resource_id:   entry.resourceId ?? null,
      metadata:      entry.metadata ?? null,
    });
  } catch (e) {
    console.error("[messenger] audit write failed:", String(e));
  }
}
