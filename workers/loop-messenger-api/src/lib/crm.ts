// Loop Messenger — loop-crm integration
// LILCKY STUDIO LIMITED

export async function writeCrmActivity(
  crmUrl: string,
  jwtToken: string,
  workspaceId: string,
  opts: {
    customerId: string;
    activityType: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await fetch(`${crmUrl}/timeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
        "X-Workspace-ID": workspaceId,
      },
      body: JSON.stringify({
        customer_id:   opts.customerId,
        activity_type: opts.activityType,
        metadata:      opts.metadata,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[messenger] CRM activity write failed:", String(e));
  }
}
