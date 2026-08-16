import type { DatasetMeta, PersonaFilters, SimulationPersona } from "./simulation";

export const DEFAULT_PERSONA_URL = "/manus-storage/civic-pulse-personas_0dc530a4.json";
export const DEFAULT_FILTER_META_URL = "/manus-storage/civic-pulse-filter-meta_7eee45a6.json";
export const DEFAULT_STATE_BOUNDARY_URL = "/manus-storage/civic-pulse-us-states_2bc7d8f9.geojson";

export const normalizePersona = (input: Partial<SimulationPersona>): SimulationPersona => ({
  id: String(input.id || input.sourceRecordId || crypto.randomUUID()),
  name: input.name?.trim() || "Synthetic participant",
  age: Number.isFinite(input.age) ? Number(input.age) : 0,
  sex: input.sex?.trim() || "Not specified",
  city: input.city?.trim() || "Not specified",
  state: input.state?.trim() || "Not specified",
  zipCode: input.zipCode?.trim() || "",
  region: input.region?.trim() || "Not specified",
  occupation: input.occupation?.trim() || "Not specified",
  educationLevel: input.educationLevel?.trim() || "Not specified",
  maritalStatus: input.maritalStatus?.trim() || "Not specified",
  bachelorsField: input.bachelorsField?.trim() || "Not specified",
  personaNarrative: input.personaNarrative?.trim() || "",
  professionalBackground: input.professionalBackground?.trim() || "",
  culturalBackground: input.culturalBackground?.trim() || "",
  hobbiesAndInterests: input.hobbiesAndInterests?.trim() || "",
  careerGoals: input.careerGoals?.trim() || "",
  skillsAndExpertise: input.skillsAndExpertise?.trim() || "",
  incomeTier: input.incomeTier?.trim() || "Not modeled",
  politicalLean: input.politicalLean?.trim() || "Not modeled",
  sourceDataset: input.sourceDataset?.trim() || "Unspecified dataset",
  sourceRecordId: input.sourceRecordId?.trim() || String(input.id || ""),
});

export const defaultFilters = (meta: DatasetMeta): PersonaFilters => ({
  ageRange: [meta.ageRange.min, meta.ageRange.max],
  sexes: [],
  educationLevels: [],
  incomeTiers: [],
  regions: [],
  politicalLeans: [],
  states: [],
  sampleSize: 50,
});

export const filterPersonas = (
  personas: SimulationPersona[],
  filters: PersonaFilters
) => personas.filter((persona) => {
  const withinAge = persona.age >= filters.ageRange[0] && persona.age <= filters.ageRange[1];
  const matches = (selected: string[], value: string) => selected.length === 0 || selected.includes(value);
  return withinAge
    && matches(filters.sexes, persona.sex)
    && matches(filters.educationLevels, persona.educationLevel)
    && matches(filters.incomeTiers, persona.incomeTier)
    && matches(filters.regions, persona.region)
    && matches(filters.politicalLeans, persona.politicalLean)
    && matches(filters.states, persona.state);
});
