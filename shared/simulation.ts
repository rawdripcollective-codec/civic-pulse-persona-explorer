export type Sentiment = "positive" | "neutral" | "negative";

export const computeWaves = (total: number): number[] => {
  const count = Math.max(0, Math.floor(total));
  if (count === 0) return [];
  if (count <= 10) return [count];
  const waves = [10, Math.min(20, count - 10)];
  const remaining = count - waves[0] - waves[1];
  return remaining > 0 ? [...waves, remaining] : waves;
};

export type SimulationPersona = {
  id: string;
  name: string;
  age: number;
  sex: string;
  city: string;
  state: string;
  zipCode: string;
  region: string;
  occupation: string;
  educationLevel: string;
  maritalStatus: string;
  bachelorsField: string;
  personaNarrative: string;
  professionalBackground: string;
  culturalBackground: string;
  hobbiesAndInterests: string;
  careerGoals: string;
  skillsAndExpertise: string;
  incomeTier: string;
  politicalLean: string;
  sourceDataset: string;
  sourceRecordId: string;
};

export type PersonaResult = {
  personaId: string;
  answer: string;
  sentiment: Sentiment;
};

export type PersonaResponse = PersonaResult & {
  persona: SimulationPersona;
};

export type SentimentSummary = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

export type PersonaFilters = {
  ageRange: [number, number];
  sexes: string[];
  educationLevels: string[];
  incomeTiers: string[];
  regions: string[];
  politicalLeans: string[];
  states: string[];
  sampleSize: number;
};

export type DatasetFieldAvailability = {
  available: boolean;
  fallback?: string;
};

export type DatasetMeta = {
  datasetName: string;
  version: string;
  sourceUrl: string;
  license: string;
  description: string;
  totalSourcePersonas: number;
  samplePersonaCount: number;
  geography: string;
  fields: Record<string, DatasetFieldAvailability>;
  occupations: string[];
  educationLevels: string[];
  states: string[];
  regions: string[];
  incomeTiers: string[];
  politicalLeans: string[];
  sexes: string[];
  ageRange: { min: number; max: number };
};

export type HistoryResult = PersonaResult & { state: string };

export type HistoryEntry = {
  id: number | string;
  sessionKey: string;
  question: string;
  filters: PersonaFilters;
  results: HistoryResult[];
  sentiment: SentimentSummary;
  personaCount: number;
  createdAt: string | number | Date;
};
