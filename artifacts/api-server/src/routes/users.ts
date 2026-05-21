import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

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

// GET /users/search?q=...
router.get("/search", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  const q = String(req.query.q || "").trim();
  if (!q) return void res.json([]);

  const users = await db
    .select()
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.displayName, `%${q}%`),
        ilike(usersTable.phone, `%${q}%`)
      )
    )
    .limit(20);

  return void res.json(users.map(formatUser));
});

// GET /users/:userId
router.get("/:userId", async (req: Request, res: Response) => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) return void res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(String(req.params.userId));
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid user ID" });

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (users.length === 0) return void res.status(404).json({ error: "User not found" });

  return void res.json(formatUser(users[0]));
});

export default router;
