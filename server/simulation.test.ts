import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLMMock = vi.fn();

import { appRouter } from "./routers";
import { buildPersonaContext, computeWaves, parseBatchResponse, setSimulationLlmInvokerForTest } from "./simulation";
import type { SimulationPersona } from "../shared/simulation";
import type { TrpcContext } from "./_core/context";

const persona = (index: number): SimulationPersona => ({
  id: `persona-${index}`,
  name: `Synthetic ${index}`,
  age: 24 + index,
  sex: "Female",
  city: "Madison",
  state: "WI",
  zipCode: "53703",
  region: "Midwest",
  occupation: "Researcher",
  educationLevel: "Bachelors",
  maritalStatus: "Never Married",
  bachelorsField: "STEM",
  personaNarrative: "A thoughtful synthetic participant who cares about practical, community-focused choices.",
  professionalBackground: "Works with data and community organizations.",
  culturalBackground: "Values shared responsibility and local relationships.",
  hobbiesAndInterests: "Hiking, reading, and neighborhood volunteering.",
  careerGoals: "To lead a mission-driven research group.",
  skillsAndExpertise: "Research, communication, and planning.",
  incomeTier: "Not modeled",
  politicalLean: "Not modeled",
  sourceDataset: "NVIDIA Nemotron-Personas-USA",
  sourceRecordId: `persona-${index}`,
});

const caller = () => appRouter.createCaller({} as TrpcContext);

const successfulReply = (personas: SimulationPersona[]) => ({
  choices: [{ message: { content: JSON.stringify({ results: personas.map((item, index) => ({ id: item.id, answer: `Response ${index}`, sentiment: index % 2 === 0 ? "positive" : "neutral" })) }) } }],
});

describe("computeWaves", () => {
  it.each([[1], [5], [10]])("returns a single wave for %i", (size) => expect(computeWaves(size)).toEqual([size]));
  it.each([[11, [10, 1]], [30, [10, 20]]])("returns two waves for %i", (size, expected) => expect(computeWaves(size)).toEqual(expected));
  it.each([[31, [10, 20, 1]], [63, [10, 20, 33]]])("returns three waves above thirty", (size, expected) => expect(computeWaves(size)).toEqual(expected));
  it("always sums to the supplied total", () => {
    for (const size of [0, 1, 8, 10, 11, 29, 30, 31, 50, 100]) {
      expect(computeWaves(size).reduce((total, wave) => total + wave, 0)).toBe(size);
    }
  });
  it("keeps the first wave at ten above ten participants", () => expect(computeWaves(88)[0]).toBe(10));
  it("never allows the second wave to exceed twenty", () => {
    for (const size of [11, 30, 31, 66, 100]) expect(computeWaves(size)[1]).toBeLessThanOrEqual(20);
  });
});

describe("persona context", () => {
  it("includes the persona’s background fields in the prompt context", () => {
    const context = buildPersonaContext(persona(1));
    expect(context).toContain("Synthetic 1");
    expect(context).toContain("Researcher");
    expect(context).toContain("community-focused");
  });
});

describe("parseBatchResponse", () => {
  const ids = ["persona-1", "persona-2"];

  it("parses a valid JSON results object", () => {
    const result = parseBatchResponse(JSON.stringify({ results: [{ id: "persona-1", answer: "I support it.", sentiment: "positive" }, { id: "persona-2", answer: "I am unsure.", sentiment: "neutral" }] }), ids);
    expect(result).toEqual([{ personaId: "persona-1", answer: "I support it.", sentiment: "positive" }, { personaId: "persona-2", answer: "I am unsure.", sentiment: "neutral" }]);
  });
  it("parses a JSON array wrapped in a Markdown code block", () => {
    const result = parseBatchResponse("```json\n[{\"id\":\"persona-1\",\"answer\":\"I disagree.\",\"sentiment\":\"negative\"}]\n```", ids);
    expect(result[0]).toMatchObject({ personaId: "persona-1", sentiment: "negative" });
  });
  it("accepts an object-wrapped results array", () => {
    const result = parseBatchResponse(JSON.stringify({ results: [{ id: "persona-2", answer: "I would need details.", sentiment: "neutral" }] }), ids);
    expect(result[1]).toMatchObject({ answer: "I would need details." });
  });
  it("returns neutral fallbacks when parsing fails", () => {
    const result = parseBatchResponse("not json", ids);
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.sentiment === "neutral")).toBe(true);
  });
  it("normalizes an unrecognized sentiment to neutral", () => {
    const result = parseBatchResponse(JSON.stringify([{ id: "persona-1", answer: "A response.", sentiment: "mixed" }]), ids);
    expect(result[0]?.sentiment).toBe("neutral");
  });
});

describe("simulation router", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
    setSimulationLlmInvokerForTest(invokeLLMMock as typeof import("./_core/llm").invokeLLM);
  });
  afterEach(() => setSimulationLlmInvokerForTest());

  it("returns parsed LLM results for a valid question", async () => {
    const personas = [persona(1), persona(2)];
    invokeLLMMock.mockResolvedValue(successfulReply(personas));
    const result = await caller().simulation.generate({ question: "Should the city improve bus lanes?", personas });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ personaId: "persona-1", sentiment: "positive" });
  });
  it("uses neutral fallbacks if the LLM call throws", async () => {
    invokeLLMMock.mockImplementation(() => { throw new Error("service unavailable"); });
    const result = await caller().simulation.generate({ question: "How should a city fund parks?", personas: [persona(1)] });
    expect(result.results[0]?.sentiment).toBe("neutral");
  });
  it("rejects an empty question", async () => {
    await expect(caller().simulation.generate({ question: " ", personas: [persona(1)] })).rejects.toThrow();
  });
  it("rejects an empty persona set", async () => {
    await expect(caller().simulation.generate({ question: "How should a city fund parks?", personas: [] })).rejects.toThrow();
  });
  it("splits a large request into groups of five", async () => {
    const personas = Array.from({ length: 22 }, (_, index) => persona(index));
    invokeLLMMock.mockImplementation(async (input?: { messages: { content: string }[] }) => {
      if (!input) return successfulReply([]);
      const content = input.messages[1]?.content || "";
      const ids = Array.from(content.matchAll(/ID: (persona-\d+)/g)).map((match) => match[1]);
      return successfulReply(personas.filter((item) => ids.includes(item.id)));
    });
    const result = await caller().simulation.generate({ question: "What would make streets safer?", personas });
    expect(result.results).toHaveLength(22);
    expect(invokeLLMMock).toHaveBeenCalledTimes(5);
  });
  it("returns wave metadata for the requested wave", async () => {
    const personas = [persona(1)];
    invokeLLMMock.mockResolvedValue(successfulReply(personas));
    const result = await caller().simulation.generateWave({ question: "How can libraries evolve?", personas, waveIndex: 1, totalWaves: 3 });
    expect(result).toMatchObject({ waveIndex: 1, totalWaves: 3, personaCount: 1 });
  });
  it("rejects a negative wave index", async () => {
    await expect(caller().simulation.generateWave({ question: "How can libraries evolve?", personas: [persona(1)], waveIndex: -1, totalWaves: 3 })).rejects.toThrow();
  });
});
