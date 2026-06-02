// Loop Messenger — rald-search integration
// LILCKY STUDIO LIMITED

export async function indexConversation(
  searchUrl: string,
  jwtToken: string,
  workspaceId: string,
  conversation: { id: string; title?: string; type: string; status: string }
): Promise<void> {
  try {
    await fetch(`${searchUrl}/index`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
        "X-Workspace-ID": workspaceId,
      },
      body: JSON.stringify({
        entity_type:  "messenger_conversation",
        entity_id:    conversation.id,
        workspace_id: workspaceId,
        content: {
          title:  conversation.title ?? "",
          type:   conversation.type,
          status: conversation.status,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[messenger] search index (conversation) failed:", String(e));
  }
}

export async function indexMessage(
  searchUrl: string,
  jwtToken: string,
  workspaceId: string,
  message: { id: string; conversationId: string; senderId: string; content: string }
): Promise<void> {
  try {
    await fetch(`${searchUrl}/index`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
        "X-Workspace-ID": workspaceId,
      },
      body: JSON.stringify({
        entity_type:  "messenger_message",
        entity_id:    message.id,
        workspace_id: workspaceId,
        content: {
          conversation_id: message.conversationId,
          sender_id:       message.senderId,
          text:            message.content.slice(0, 2000),
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[messenger] search index (message) failed:", String(e));
  }
}
