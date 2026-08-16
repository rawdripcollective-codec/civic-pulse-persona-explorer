import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), insert: vi.fn(), values: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const caller = () => appRouter.createCaller({} as TrpcContext);
const payload = {
  sessionKey: "session-12345678",
  question: "How can local government strengthen civic trust?",
  filters: { ageRange: [18, 65], sexes: ["Female"], sampleSize: 25 },
  results: [{ personaId: "persona-1", answer: "I would value clear follow-through.", sentiment: "positive" as const, state: "WI" }],
  sentiment: { positive: 1, neutral: 0, negative: 0, total: 1 },
  personaCount: 1,
};

describe("history router", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.values.mockResolvedValue([{ insertId: 42 }]);
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.limit.mockResolvedValue([]);
    mocks.orderBy.mockReturnValue({ limit: mocks.limit });
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.getDb.mockResolvedValue({ insert: mocks.insert, select: mocks.select });
  });

  it("persists filters, results, sentiment, and a session key as one history snapshot", async () => {
    const result = await caller().history.save(payload);
    expect(result).toEqual({ persisted: true, id: 42 });
    expect(mocks.values).toHaveBeenCalledWith(payload);
  });

  it("returns a non-persisted result when the history database is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(caller().history.save(payload)).resolves.toEqual({ persisted: false });
  });

  it("returns recent snapshots scoped to the requested browser session", async () => {
    const row = { id: 5, ...payload, createdAt: new Date("2026-08-16T00:00:00Z") };
    mocks.limit.mockResolvedValue([row]);
    const result = await caller().history.list({ sessionKey: payload.sessionKey });
    expect(result).toEqual([row]);
    expect(mocks.limit).toHaveBeenCalledWith(50);
  });

  it("rejects malformed history payloads before a database operation", async () => {
    await expect(caller().history.save({ ...payload, results: [] })).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
