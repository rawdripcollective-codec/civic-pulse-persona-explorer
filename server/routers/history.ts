import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { simulationHistory } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const sessionSchema = z.string().trim().min(8).max(96);
const sentimentSchema = z.object({ positive: z.number().int().min(0), neutral: z.number().int().min(0), negative: z.number().int().min(0), total: z.number().int().min(0) });
const resultSchema = z.object({ personaId: z.string(), answer: z.string().max(2000), sentiment: z.enum(["positive", "neutral", "negative"]), state: z.string().max(32) });

export const historyRouter = router({
  list: publicProcedure.input(z.object({ sessionKey: sessionSchema })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(simulationHistory).where(eq(simulationHistory.sessionKey, input.sessionKey)).orderBy(desc(simulationHistory.createdAt)).limit(50);
  }),
  save: publicProcedure.input(z.object({ sessionKey: sessionSchema, question: z.string().trim().min(1).max(600), filters: z.record(z.string(), z.unknown()), results: z.array(resultSchema).min(1).max(100), sentiment: sentimentSchema, personaCount: z.number().int().min(1).max(100) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { persisted: false };
    const result = await db.insert(simulationHistory).values({ ...input });
    return { persisted: true, id: result[0].insertId };
  }),
});
