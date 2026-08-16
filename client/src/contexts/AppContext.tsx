import { trpc } from "@/lib/trpc";
import { DEFAULT_FILTER_META_URL, DEFAULT_PERSONA_URL, DEFAULT_STATE_BOUNDARY_URL, defaultFilters, filterPersonas, normalizePersona } from "@shared/personas";
import { computeWaves, type DatasetMeta, type HistoryEntry, type PersonaFilters, type PersonaResponse, type SentimentSummary, type SimulationPersona } from "@shared/simulation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SimulationPhase = "idle" | "thinking" | "drafting" | "delivering" | "error";
type DatasetConfig = { personaUrl: string; metaUrl: string; boundaryUrl: string; domainLabel: string; geographyEnabled: boolean; defaultSampleSize: number };
type WaveProgress = { currentWave: number; totalWaves: number; completedPersonas: number; totalPersonas: number; waveSizes: number[] };

type AppContextValue = {
  personas: SimulationPersona[];
  meta: DatasetMeta | null;
  filters: PersonaFilters | null;
  filteredCount: number;
  phase: SimulationPhase;
  waveProgress: WaveProgress;
  responses: PersonaResponse[];
  question: string;
  error: string | null;
  history: HistoryEntry[];
  stateStats: Record<string, { total: number; positive: number; neutral: number; negative: number; dominant: "positive" | "neutral" | "negative" }>;
  selectedState: string | null;
  datasetConfig: DatasetConfig;
  setQuestion: (question: string) => void;
  updateFilters: (partial: Partial<PersonaFilters>) => void;
  resetFilters: () => void;
  setSelectedState: (state: string | null) => void;
  submitQuestion: (question?: string) => Promise<void>;
  loadHistoryEntry: (entry: HistoryEntry) => void;
  applyDatasetConfig: (config: DatasetConfig) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const emptySummary: SentimentSummary = { positive: 0, neutral: 0, negative: 0, total: 0 };
const storageKey = "civic-pulse-config";
const historyKey = "civic-pulse-local-history";
const sessionStorageKey = "civic-pulse-session-key";

const sleep = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const parseJsonField = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return (value as T) || fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const summarize = (responses: PersonaResponse[]): SentimentSummary => responses.reduce((summary, response) => ({ ...summary, [response.sentiment]: summary[response.sentiment] + 1, total: summary.total + 1 }), emptySummary);
const pickSample = (pool: SimulationPersona[], count: number, seed: string) => {
  const offset = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0) % Math.max(pool.length, 1);
  return [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, Math.min(count, 100));
};
const stateMetrics = (responses: PersonaResponse[]) => {
  const stats: AppContextValue["stateStats"] = {};
  responses.forEach(({ persona, sentiment }) => {
    if (!stats[persona.state]) stats[persona.state] = { total: 0, positive: 0, neutral: 0, negative: 0, dominant: "neutral" };
    stats[persona.state][sentiment] += 1;
    stats[persona.state].total += 1;
  });
  const sentimentOrder: Array<"positive" | "neutral" | "negative"> = ["positive", "neutral", "negative"];
  Object.values(stats).forEach((stat) => {
    stat.dominant = sentimentOrder.reduce<"positive" | "neutral" | "negative">((current, candidate) => stat[candidate] > stat[current] ? candidate : current, "neutral");
  });
  return stats;
};

const initialConfig: DatasetConfig = { personaUrl: DEFAULT_PERSONA_URL, metaUrl: DEFAULT_FILTER_META_URL, boundaryUrl: DEFAULT_STATE_BOUNDARY_URL, domainLabel: "Civic Futures", geographyEnabled: true, defaultSampleSize: 50 };
const sessionKey = () => {
  const existing = localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const key = crypto.randomUUID();
  localStorage.setItem(sessionStorageKey, key);
  return key;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DatasetConfig>(() => ({ ...initialConfig, ...parseJsonField<Partial<DatasetConfig>>(localStorage.getItem(storageKey), {}) }));
  const [personas, setPersonas] = useState<SimulationPersona[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [filters, setFilters] = useState<PersonaFilters | null>(null);
  const [phase, setPhase] = useState<SimulationPhase>("thinking");
  const [waveProgress, setWaveProgress] = useState<WaveProgress>({ currentWave: 0, totalWaves: 0, completedPersonas: 0, totalPersonas: 0, waveSizes: [] });
  const [responses, setResponses] = useState<PersonaResponse[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => parseJsonField(localStorage.getItem(historyKey), []));
  const activeSessionKey = useMemo(sessionKey, []);
  const generateWave = trpc.simulation.generateWave.useMutation();
  const historySave = trpc.history.save.useMutation();
  const databaseHistory = trpc.history.list.useQuery({ sessionKey: activeSessionKey });

  const loadDataset = useCallback(async (nextConfig: DatasetConfig) => {
    setPhase("thinking");
    setError(null);
    try {
      const [personasResponse, metaResponse] = await Promise.all([fetch(nextConfig.personaUrl), fetch(nextConfig.metaUrl)]);
      if (!personasResponse.ok || !metaResponse.ok) throw new Error("The configured dataset endpoint did not return a usable response.");
      const [rawPersonas, rawMeta] = await Promise.all([personasResponse.json(), metaResponse.json()]);
      if (!Array.isArray(rawPersonas) || !rawMeta?.datasetName) throw new Error("The dataset does not match the Civic Pulse adapter contract.");
      const normalized = rawPersonas.map(normalizePersona).filter((persona) => persona.age > 0 && persona.id);
      const nextMeta = rawMeta as DatasetMeta;
      setPersonas(normalized);
      setMeta(nextMeta);
      setFilters({ ...defaultFilters(nextMeta), sampleSize: Math.min(100, Math.max(10, nextConfig.defaultSampleSize)) });
      setResponses([]);
      setSelectedState(null);
      setPhase("idle");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the persona dataset.");
      setPhase("error");
    }
  }, []);

  useEffect(() => { void loadDataset(config); }, [config, loadDataset]);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 50))); }, [history]);
  useEffect(() => {
    if (!databaseHistory.data?.length) return;
    const restored = databaseHistory.data.map((row) => ({
      id: row.id,
      sessionKey: row.sessionKey,
      question: row.question,
      filters: parseJsonField<PersonaFilters>(row.filters, filters || { ageRange: [0, 120], sexes: [], educationLevels: [], incomeTiers: [], regions: [], politicalLeans: [], states: [], sampleSize: 50 }),
      results: parseJsonField(row.results, []),
      sentiment: parseJsonField<SentimentSummary>(row.sentiment, emptySummary),
      personaCount: row.personaCount,
      createdAt: row.createdAt,
    })) as HistoryEntry[];
    setHistory((current) => [...restored, ...current.filter((entry) => !restored.some((saved) => String(saved.id) === String(entry.id)))].slice(0, 50));
  }, [databaseHistory.data, filters]);

  const filteredPersonas = useMemo(() => filters ? filterPersonas(personas, filters) : [], [personas, filters]);
  const updateFilters = useCallback((partial: Partial<PersonaFilters>) => setFilters((current) => current ? { ...current, ...partial } : current), []);
  const resetFilters = useCallback(() => { if (meta) { setFilters(defaultFilters(meta)); setSelectedState(null); } }, [meta]);
  const setSelectedStateFilter = useCallback((state: string | null) => {
    setSelectedState(state);
    updateFilters({ states: state ? [state] : [] });
  }, [updateFilters]);

  const submitQuestion = useCallback(async (submittedQuestion?: string) => {
    const normalizedQuestion = (submittedQuestion || question).trim();
    if (!normalizedQuestion || !filters) return;
    const sample = pickSample(filteredPersonas, filters.sampleSize, normalizedQuestion);
    if (sample.length === 0) { setError("No personas match the active filters. Adjust a filter and try again."); setPhase("error"); return; }
    setError(null);
    setQuestion(normalizedQuestion);
    setResponses([]);
    setPhase("thinking");
    const waveSizes = computeWaves(sample.length);
    setWaveProgress({ currentWave: 0, totalWaves: waveSizes.length, completedPersonas: 0, totalPersonas: sample.length, waveSizes });
    await sleep(320);
    const accumulated: PersonaResponse[] = [];
    let cursor = 0;
    try {
      for (let waveIndex = 0; waveIndex < waveSizes.length; waveIndex += 1) {
        setPhase("drafting");
        const currentPeople = sample.slice(cursor, cursor + waveSizes[waveIndex]);
        const wave = await generateWave.mutateAsync({ question: normalizedQuestion, personas: currentPeople, waveIndex, totalWaves: waveSizes.length });
        cursor += currentPeople.length;
        setPhase("delivering");
        for (const result of wave.results) {
          const persona = currentPeople.find((candidate) => candidate.id === result.personaId);
          if (!persona) continue;
          const next = { persona, answer: result.answer, sentiment: result.sentiment } as PersonaResponse;
          accumulated.push(next);
          setResponses([...accumulated]);
          setWaveProgress({ currentWave: waveIndex + 1, totalWaves: waveSizes.length, completedPersonas: accumulated.length, totalPersonas: sample.length, waveSizes });
          await sleep(58);
        }
      }
      const sentiment = summarize(accumulated);
      const entry: HistoryEntry = { id: `local-${Date.now()}`, sessionKey: activeSessionKey, question: normalizedQuestion, filters, results: accumulated.map((item) => ({ personaId: item.persona.id, answer: item.answer, sentiment: item.sentiment, state: item.persona.state })), sentiment, personaCount: accumulated.length, createdAt: new Date().toISOString() };
      setHistory((current) => [entry, ...current].slice(0, 50));
      void historySave.mutateAsync({ sessionKey: activeSessionKey, question: entry.question, filters: entry.filters as unknown as Record<string, unknown>, results: entry.results, sentiment: entry.sentiment, personaCount: entry.personaCount });
      setPhase("idle");
    } catch (simulationError) {
      setError(simulationError instanceof Error ? simulationError.message : "The simulation could not be completed.");
      setPhase("error");
    }
  }, [activeSessionKey, filteredPersonas, filters, generateWave, historySave, question]);

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    const index = new Map(personas.map((persona) => [persona.id, persona]));
    const restored = entry.results.flatMap((result) => {
      const persona = index.get(result.personaId);
      return persona ? [{ persona, answer: result.answer, sentiment: result.sentiment }] : [];
    }) as PersonaResponse[];
    setQuestion(entry.question);
    setFilters(entry.filters);
    setSelectedState(entry.filters.states[0] || null);
    setResponses(restored);
    setWaveProgress({ currentWave: 0, totalWaves: 0, completedPersonas: restored.length, totalPersonas: restored.length, waveSizes: [] });
    setPhase("idle");
  }, [personas]);

  const applyDatasetConfig = useCallback(async (nextConfig: DatasetConfig) => {
    setConfig(nextConfig);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    personas, meta, filters, filteredCount: filteredPersonas.length, phase, waveProgress, responses, question, error, history,
    stateStats: stateMetrics(responses), selectedState, datasetConfig: config, setQuestion, updateFilters, resetFilters,
    setSelectedState: setSelectedStateFilter, submitQuestion, loadHistoryEntry, applyDatasetConfig,
  }), [personas, meta, filters, filteredPersonas.length, phase, waveProgress, responses, question, error, history, selectedState, config, setQuestion, updateFilters, resetFilters, setSelectedStateFilter, submitQuestion, loadHistoryEntry, applyDatasetConfig]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useCivicPulse = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useCivicPulse must be used within AppProvider");
  return context;
};
