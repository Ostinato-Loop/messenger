import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  messagesTable,
  messageReactionsTable,
  conversationMembersTable,
  conversationsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    phone: u.phone,
    displayName: u.displayName,
    bio: u.bio,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

async function buildMessage(msg: typeof messagesTable.$inferSelect) {
  const sender = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, msg.senderId))
    .limit(1);

  const reactions = await db
    .select({ reaction: messageReactionsTable, user: usersTable })
    .from(messageReactionsTable)
    .innerJoin(usersTable, eq(messageReactionsTable.userId, usersTable.id))
    .where(eq(messageReactionsTable.messageId, msg.id));

  let replyTo = null;
  if (msg.replyToId) {
    const parent = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, msg.replyToId))
      .limit(1);
    if (parent.length) {
      const parentSender = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, parent[0].senderId))
        .limit(1);
      replyTo = {
        id: parent[0].id,
        conversationId: parent[0].conversationId,
        senderId: parent[0].senderId,
        type: parent[0].type,
        content: parent[0].content,
        mediaUrl: parent[0].mediaUrl,
        replyToId: parent[0].replyToId,
        isDeleted: parent[0].isDeleted,
        editedAt: parent[0].editedAt?.toISOString() ?? null,
        createdAt: parent[0].createdAt.toISOString(),
        sender: parentSender.length ? formatUser(parentSender[0]) : null,
        reactions: [],
        replyTo: null,
      };
    }
  }

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    type: msg.type,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    replyToId: msg.replyToId,
    isDeleted: msg.isDeleted,
    editedAt: msg.editedAt?.toISOString() ?? null,
    createdAt: msg.createdAt.toISOString(),
    sender: sender.length ? formatUser(sender[0]) : null,
    reactions: reactions.map((r) => ({
      messageId: r.reaction.messageId,
      userId: r.reaction.userId,
      emoji: r.reaction.emoji,
      createdAt: r.reaction.createdAt.toISOString(),
      user: formatUser(r.user),
    })),
    replyTo,
  };
}

// GET /conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const convId = parseInt(req.params.conversationId);
  if (isNaN(convId)) return void res.status(400).json({ error: "Invalid ID" });

  const isMember = await db
    .select()
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        eq(conversationMembersTable.userId, userId)
      )
    )
    .limit(1);
  if (!isMember.length) return void res.status(403).json({ error: "Forbidden" });

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(50);

  const built = await Promise.all(msgs.reverse().map(buildMessage));
  return void res.json(built);
});

// POST /conversations/:conversationId/messages
router.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const convId = parseInt(req.params.conversationId);
  if (isNaN(convId)) return void res.status(400).json({ error: "Invalid ID" });

  const isMember = await db
    .select()
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        eq(conversationMembersTable.userId, userId)
      )
    )
    .limit(1);
  if (!isMember.length) return void res.status(403).json({ error: "Forbidden" });

  const { type = "text", content, mediaUrl, replyToId } = req.body;

  const inserted = await db
    .insert(messagesTable)
    .values({
      conversationId: convId,
      senderId: userId,
      type,
      content: content ?? null,
      mediaUrl: mediaUrl ?? null,
      replyToId: replyToId ?? null,
    })
    .returning();

  // Update conversation updatedAt
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const built = await buildMessage(inserted[0]);
  return void res.status(201).json(built);
});

// PATCH /messages/:messageId
router.patch("/messages/:messageId", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const msgId = parseInt(req.params.messageId);
  if (isNaN(msgId)) return void res.status(400).json({ error: "Invalid ID" });

  const msg = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, msgId))
    .limit(1);
  if (!msg.length) return void res.status(404).json({ error: "Not found" });
  if (msg[0].senderId !== userId) return void res.status(403).json({ error: "Forbidden" });

  const updated = await db
    .update(messagesTable)
    .set({ content: req.body.content, editedAt: new Date() })
    .where(eq(messagesTable.id, msgId))
    .returning();

  const built = await buildMessage(updated[0]);
  return void res.json(built);
});

// DELETE /messages/:messageId
router.delete("/messages/:messageId", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const msgId = parseInt(req.params.messageId);
  if (isNaN(msgId)) return void res.status(400).json({ error: "Invalid ID" });

  const msg = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, msgId))
    .limit(1);
  if (!msg.length) return void res.status(404).json({ error: "Not found" });
  if (msg[0].senderId !== userId) return void res.status(403).json({ error: "Forbidden" });

  await db
    .update(messagesTable)
    .set({ isDeleted: true, content: null })
    .where(eq(messagesTable.id, msgId));

  return void res.json({ ok: true });
});

// POST /messages/:messageId/reactions
router.post("/messages/:messageId/reactions", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const msgId = parseInt(req.params.messageId);
  if (isNaN(msgId)) return void res.status(400).json({ error: "Invalid ID" });

  const { emoji } = req.body;
  if (!emoji) return void res.status(400).json({ error: "Emoji required" });

  const inserted = await db
    .insert(messageReactionsTable)
    .values({ messageId: msgId, userId, emoji })
    .onConflictDoNothing()
    .returning();

  if (!inserted.length) {
    const existing = await db
      .select({ reaction: messageReactionsTable, user: usersTable })
      .from(messageReactionsTable)
      .innerJoin(usersTable, eq(messageReactionsTable.userId, usersTable.id))
      .where(
        and(
          eq(messageReactionsTable.messageId, msgId),
          eq(messageReactionsTable.userId, userId),
          eq(messageReactionsTable.emoji, emoji)
        )
      )
      .limit(1);
    const r = existing[0];
    return void res.status(201).json({
      messageId: r.reaction.messageId,
      userId: r.reaction.userId,
      emoji: r.reaction.emoji,
      createdAt: r.reaction.createdAt.toISOString(),
      user: formatUser(r.user),
    });
  }

  const r = inserted[0];
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return void res.status(201).json({
    messageId: r.messageId,
    userId: r.userId,
    emoji: r.emoji,
    createdAt: r.createdAt.toISOString(),
    user: user.length ? formatUser(user[0]) : null,
  });
});

// DELETE /messages/:messageId/reactions/:emoji
router.delete("/messages/:messageId/reactions/:emoji", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const msgId = parseInt(req.params.messageId);
  if (isNaN(msgId)) return void res.status(400).json({ error: "Invalid ID" });

  await db
    .delete(messageReactionsTable)
    .where(
      and(
        eq(messageReactionsTable.messageId, msgId),
        eq(messageReactionsTable.userId, userId),
        eq(messageReactionsTable.emoji, req.params.emoji)
      )
    );

  return void res.json({ ok: true });
});

export default router;
