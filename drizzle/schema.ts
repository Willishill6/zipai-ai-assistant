import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Analysis records - stores each screenshot analysis session */
export const analysisRecords = mysqlTable("analysis_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** URL to the uploaded screenshot in S3 */
  screenshotUrl: text("screenshotUrl"),
  /** Recognized hand tiles as JSON array */
  handTiles: json("handTiles"),
  /** Recognized exposed tiles (chi/peng/wei/ti/pao) as JSON */
  exposedTiles: json("exposedTiles"),
  /** Opponent's discarded tiles as JSON */
  opponentDiscards: json("opponentDiscards"),
  /** Current hu-xi count recognized */
  currentHuxi: int("currentHuxi").default(0),
  /** Ghost card (feifei) info */
  ghostCards: json("ghostCards"),
  /** Remaining tiles count */
  remainingTiles: int("remainingTiles"),
  /** AI suggestion text */
  aiSuggestion: text("aiSuggestion"),
  /** AI recommended action: discard/chi/peng/hu/pass */
  recommendedAction: varchar("recommendedAction", { length: 32 }),
  /** The specific tile AI recommends to play */
  recommendedTile: varchar("recommendedTile", { length: 16 }),
  /** Full AI analysis reasoning */
  analysisReasoning: text("analysisReasoning"),
  /** Raw LLM response for debugging */
  rawLlmResponse: text("rawLlmResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisRecord = typeof analysisRecords.$inferSelect;
export type InsertAnalysisRecord = typeof analysisRecords.$inferInsert;

/** Game statistics - aggregated stats per user */
export const gameStats = mysqlTable("game_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Total games analyzed */
  totalGames: int("totalGames").default(0),
  /** Games where user won (hu-ed) */
  gamesWon: int("gamesWon").default(0),
  /** Total hu-xi accumulated */
  totalHuxi: int("totalHuxi").default(0),
  /** Average hu-xi per game */
  avgHuxi: float("avgHuxi").default(0),
  /** Most common mistake type */
  commonMistake: text("commonMistake"),
  /** Win rate percentage */
  winRate: float("winRate").default(0),
  /** Streak data as JSON */
  streakData: json("streakData"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameStat = typeof gameStats.$inferSelect;
export type InsertGameStat = typeof gameStats.$inferInsert;

/** Virtual practice sessions */
export const practiceSessions = mysqlTable("practice_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Current game state as JSON */
  gameState: json("gameState"),
  /** Move history as JSON array */
  moveHistory: json("moveHistory"),
  /** Game result: win/lose/ongoing */
  result: varchar("result", { length: 16 }).default("ongoing"),
  /** Final hu-xi score */
  finalHuxi: int("finalHuxi").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeSession = typeof practiceSessions.$inferSelect;
export type InsertPracticeSession = typeof practiceSessions.$inferInsert;
