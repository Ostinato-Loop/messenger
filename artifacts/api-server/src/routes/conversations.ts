import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
  messageReactionsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

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

async function getConversationWithMembers(convId: number) {
  const conv = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId))
    .limit(1);
  if (!conv.length) return null;

  const members = await db
    .select({
      member: conversationMembersTable,
      user: usersTable,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, convId));

  return {
    ...conv[0],
    members: members.map((m) => ({
      userId: m.member.userId,
      role: m.member.role,
      joinedAt: m.member.joinedAt.toISOString(),
      user: formatUser(m.user),
    })),
  };
}

// GET /conversations
router.get("/", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  // Get all conversations the user is part of
  const memberRows = await db
    .select()
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, userId));

  if (!memberRows.length) return void res.json([]);

  const convIds = memberRows.map((r) => r.conversationId);
  const convs = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, convIds))
    .orderBy(desc(conversationsTable.updatedAt));

  const result = await Promise.all(
    convs.map(async (conv) => {
      const members = await db
        .select({ member: conversationMembersTable, user: usersTable })
        .from(conversationMembersTable)
        .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
        .where(eq(conversationMembersTable.conversationId, conv.id));

      const myMember = memberRows.find((r) => r.conversationId === conv.id);
      const lastReadAt = myMember?.lastReadAt ?? new Date(0);

      // Count unread
      const unreadResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conv.id),
            sql`${messagesTable.createdAt} > ${lastReadAt}`,
            sql`${messagesTable.senderId} != ${userId}`
          )
        );
      const unreadCount = unreadResult[0]?.count ?? 0;

      // Last message
      const lastMsgs = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      let lastMessage = null;
      if (lastMsgs.length > 0) {
        const lm = lastMsgs[0];
        const sender = members.find((m) => m.user.id === lm.senderId);
        lastMessage = {
          id: lm.id,
          conversationId: lm.conversationId,
          senderId: lm.senderId,
          type: lm.type,
          content: lm.content,
          mediaUrl: lm.mediaUrl,
          replyToId: lm.replyToId,
          isDeleted: lm.isDeleted,
          editedAt: lm.editedAt?.toISOString() ?? null,
          createdAt: lm.createdAt.toISOString(),
          sender: sender ? formatUser(sender.user) : null,
          reactions: [],
          replyTo: null,
        };
      }

      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatar: conv.avatar,
        unreadCount,
        lastMessage,
        members: members.map((m) => ({
          userId: m.member.userId,
          role: m.member.role,
          joinedAt: m.member.joinedAt.toISOString(),
          user: formatUser(m.user),
        })),
        createdAt: conv.createdAt.toISOString(),
      };
    })
  );

  return void res.json(result);
});

// GET /conversations/stats
router.get("/stats", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const memberRows = await db
    .select()
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, userId));

  const convIds = memberRows.map((r) => r.conversationId);
  if (!convIds.length) {
    return void res.json({ totalConversations: 0, totalUnread: 0, directCount: 0, groupCount: 0 });
  }

  const convs = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, convIds));

  let totalUnread = 0;
  for (const mr of memberRows) {
    const unreadResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, mr.conversationId),
          sql`${messagesTable.createdAt} > ${mr.lastReadAt}`,
          sql`${messagesTable.senderId} != ${userId}`
        )
      );
    totalUnread += unreadResult[0]?.count ?? 0;
  }

  return void res.json({
    totalConversations: convs.length,
    totalUnread,
    directCount: convs.filter((c) => c.type === "direct").length,
    groupCount: convs.filter((c) => c.type === "group").length,
  });
});

// POST /conversations
router.post("/", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const { type, name, memberIds } = req.body;
  if (!type || !memberIds || !Array.isArray(memberIds)) {
    return void res.status(400).json({ error: "Invalid input" });
  }

  const allMembers: number[] = Array.from(new Set([userId, ...memberIds]));

  // For direct chats, check if one already exists
  if (type === "direct" && allMembers.length === 2) {
    const otherId = allMembers.find((id) => id !== userId)!;
    const existing = await db
      .select({ conv: conversationsTable })
      .from(conversationsTable)
      .innerJoin(
        conversationMembersTable,
        and(
          eq(conversationMembersTable.conversationId, conversationsTable.id),
          eq(conversationMembersTable.userId, userId)
        )
      )
      .where(eq(conversationsTable.type, "direct"));

    for (const row of existing) {
      const otherMembers = await db
        .select()
        .from(conversationMembersTable)
        .where(
          and(
            eq(conversationMembersTable.conversationId, row.conv.id),
            eq(conversationMembersTable.userId, otherId)
          )
        );
      if (otherMembers.length > 0) {
        const detail = await getConversationWithMembers(row.conv.id);
        return void res.status(201).json(detail);
      }
    }
  }

  const newConv = await db
    .insert(conversationsTable)
    .values({ type, name: name ?? null })
    .returning();

  const conv = newConv[0];

  await db.insert(conversationMembersTable).values(
    allMembers.map((uid) => ({
      conversationId: conv.id,
      userId: uid,
      role: uid === userId ? "admin" : "member",
    }))
  );

  const detail = await getConversationWithMembers(conv.id);
  return void res.status(201).json(detail);
});

// GET /conversations/:id
router.get("/:conversationId", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const convId = parseInt(String(req.params.conversationId));
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

  if (!isMember.length) return void res.status(404).json({ error: "Not found" });

  const detail = await getConversationWithMembers(convId);
  if (!detail) return void res.status(404).json({ error: "Not found" });

  return void res.json({
    ...detail,
    createdAt: detail.createdAt.toISOString(),
  });
});

// PATCH /conversations/:id
router.patch("/:conversationId", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const convId = parseInt(String(req.params.conversationId));
  if (isNaN(convId)) return void res.status(400).json({ error: "Invalid ID" });

  const { name, avatar } = req.body;
  const updated = await db
    .update(conversationsTable)
    .set({ name, avatar, updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId))
    .returning();

  if (!updated.length) return void res.status(404).json({ error: "Not found" });

  const c = updated[0];
  return void res.json({
    id: c.id,
    type: c.type,
    name: c.name,
    avatar: c.avatar,
    createdAt: c.createdAt.toISOString(),
  });
});

// POST /conversations/:id/read
router.post("/:conversationId/read", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const convId = parseInt(String(req.params.conversationId));
  if (isNaN(convId)) return void res.status(400).json({ error: "Invalid ID" });

  await db
    .update(conversationMembersTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        eq(conversationMembersTable.userId, userId)
      )
    );

  return void res.json({ ok: true });
});

export default router;
