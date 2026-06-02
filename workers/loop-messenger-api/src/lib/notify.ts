// Loop Messenger — rald-notify integration
// LILCKY STUDIO LIMITED

interface NotifyPayload {
  workspace_id: string;
  type: string;
  recipient_id: string;
  data: Record<string, unknown>;
}

export async function triggerNotification(
  notifyUrl: string,
  jwtToken: string,
  payload: NotifyPayload
): Promise<void> {
  try {
    await fetch(`${notifyUrl}/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
        "X-Workspace-ID": payload.workspace_id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[messenger] notify trigger failed:", String(e));
  }
}

export async function notifyNewMessage(
  notifyUrl: string,
  jwtToken: string,
  opts: {
    workspaceId: string;
    recipientId: string;
    conversationId: string;
    senderName: string;
    preview: string;
  }
): Promise<void> {
  await triggerNotification(notifyUrl, jwtToken, {
    workspace_id:  opts.workspaceId,
    type:          "new_message",
    recipient_id:  opts.recipientId,
    data: {
      conversation_id: opts.conversationId,
      sender_name:     opts.senderName,
      preview:         opts.preview.slice(0, 100),
    },
  });
}

export async function notifyMention(
  notifyUrl: string,
  jwtToken: string,
  opts: {
    workspaceId: string;
    recipientId: string;
    conversationId: string;
    senderName: string;
    messageId: string;
  }
): Promise<void> {
  await triggerNotification(notifyUrl, jwtToken, {
    workspace_id:  opts.workspaceId,
    type:          "mention",
    recipient_id:  opts.recipientId,
    data: {
      conversation_id: opts.conversationId,
      sender_name:     opts.senderName,
      message_id:      opts.messageId,
    },
  });
}

export async function notifyAssignment(
  notifyUrl: string,
  jwtToken: string,
  opts: {
    workspaceId: string;
    recipientId: string;
    conversationId: string;
    assignedBy: string;
  }
): Promise<void> {
  await triggerNotification(notifyUrl, jwtToken, {
    workspace_id:  opts.workspaceId,
    type:          "assignment",
    recipient_id:  opts.recipientId,
    data: {
      conversation_id: opts.conversationId,
      assigned_by:     opts.assignedBy,
    },
  });
}
