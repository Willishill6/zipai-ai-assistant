import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  analysisRecords,
  InsertAnalysisRecord,
  gameStats,
  InsertGameStat,
  practiceSessions,
  InsertPracticeSession,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Analysis Records =====

export async function createAnalysisRecord(record: InsertAnalysisRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analysisRecords).values(record);
  return result[0].insertId;
}

export async function getAnalysisRecords(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(analysisRecords)
    .where(eq(analysisRecords.userId, userId))
    .orderBy(desc(analysisRecords.createdAt))
    .limit(limit);
}

export async function deleteAnalysisRecord(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(analysisRecords)
    .where(eq(analysisRecords.id, id));
}

// ===== Game Stats =====

export async function getGameStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertGameStats(userId: number, updates: Partial<InsertGameStat>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getGameStats(userId);
  if (existing) {
    await db
      .update(gameStats)
      .set(updates)
      .where(eq(gameStats.userId, userId));
  } else {
    await db.insert(gameStats).values({ userId, ...updates });
  }
}

// ===== Practice Sessions =====

export async function createPracticeSession(session: InsertPracticeSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(practiceSessions).values(session);
  return result[0].insertId;
}

export async function updatePracticeSession(
  id: number,
  updates: Partial<InsertPracticeSession>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(practiceSessions).set(updates).where(eq(practiceSessions.id, id));
}

export async function getPracticeSession(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
