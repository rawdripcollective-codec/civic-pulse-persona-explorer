import { invokeLLM } from "./_core/llm";
import { computeWaves } from "../shared/simulation";
import type { PersonaResult, Sentiment, SimulationPersona } from "../shared/simulation";

export { computeWaves } from "../shared/simulation";

const MAX_CONTEXT_LENGTH = 260;
type LlmInvoker = typeof invokeLLM;
let llmInvoker: LlmInvoker = invokeLLM;

/** Test seam that keeps the production integration server-side and deterministic in Vitest. */
export const setSimulationLlmInvokerForTest = (invoker?: LlmInvoker) => {
  llmInvoker = invoker || invokeLLM;
};

const shorten = (value: string) => value.length > MAX_CONTEXT_LENGTH ? `${value.slice(0, MAX_CONTEXT_LENGTH - 1).trimEnd()}…` : value;

const normalizedSentiment = (value: unknown): Sentiment => (
  value === "positive" || value === "negative" || value === "neutral" ? value : "neutral"
);

export const buildPersonaContext = (persona: SimulationPersona): string => [
  `Synthetic persona: ${persona.name}, ${persona.age}, ${persona.sex}.`,
  `Location: ${persona.city}, ${persona.state} (${persona.region}).`,
  `Occupation: ${persona.occupation}. Education: ${persona.educationLevel}. Marital status: ${persona.maritalStatus}.`,
  `Profile: ${shorten(persona.personaNarrative)}`,
  `Professional background: ${shorten(persona.professionalBackground)}`,
  `Cultural background: ${shorten(persona.culturalBackground)}`,
  `Hobbies and interests: ${shorten(persona.hobbiesAndInterests)}`,
  `Career goals: ${shorten(persona.careerGoals)}`,
].filter((line) => !line.endsWith(": ")).join("\n");

export const buildBatchPrompt = (question: string, personas: SimulationPersona[]): string => `Question: ${question}\n\nYou are generating explicitly synthetic, illustrative viewpoints. Do not claim that any response represents a real person, real survey result, population estimate, or factual consensus. For every persona below, write a grounded first-person answer in two or three concise sentences. Let the persona's stated background inform its concerns and priorities without stereotyping. Output a JSON object only with a \\"results\\" array. Each item must be {\"id\": string, \"answer\": string, \"sentiment\": \"positive\" | \"neutral\" | \"negative\"}.\n\n${personas.map((persona) => `ID: ${persona.id}\n${buildPersonaContext(persona)}`).join("\n\n---\n\n")}`;

const fallback = (personaId: string): PersonaResult => ({
  personaId,
  answer: "I would want more context before taking a position, especially how this would affect people in my community.",
  sentiment: "neutral",
});

export const parseBatchResponse = (raw: string, personaIds: string[]): PersonaResult[] => {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as unknown;
    const candidates = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { results?: unknown }).results)
        ? (parsed as { results: unknown[] }).results
        : [];
    const byId = new Map<string, PersonaResult>();
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const record = candidate as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : typeof record.personaId === "string" ? record.personaId : "";
      if (!personaIds.includes(id) || typeof record.answer !== "string" || record.answer.trim().length === 0) continue;
      byId.set(id, { personaId: id, answer: record.answer.trim(), sentiment: normalizedSentiment(record.sentiment) });
    }
    return personaIds.map((id) => byId.get(id) || fallback(id));
  } catch {
    return personaIds.map(fallback);
  }
};

const requestBatch = async (question: string, personas: SimulationPersona[]): Promise<PersonaResult[]> => {
  try {
    const response = await llmInvoker({
      messages: [
        { role: "system", content: "You generate safe, concise, valid JSON for a synthetic persona simulator." },
        { role: "user", content: buildBatchPrompt(question, personas) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1800,
    });
    const content = response.choices[0]?.message.content;
    return parseBatchResponse(typeof content === "string" ? content : "", personas.map((persona) => persona.id));
  } catch {
    return personas.map((persona) => fallback(persona.id));
  }
};

export const generateWaveResponses = async (question: string, personas: SimulationPersona[]): Promise<PersonaResult[]> => {
  const batches = Array.from({ length: Math.ceil(personas.length / 5) }, (_, index) => personas.slice(index * 5, index * 5 + 5));
  const responses: PersonaResult[] = [];
  for (let index = 0; index < batches.length; index += 4) {
    const batchGroup = batches.slice(index, index + 4);
    responses.push(...(await Promise.all(batchGroup.map((batch) => requestBatch(question, batch)))).flat());
  }
  return responses;
};
