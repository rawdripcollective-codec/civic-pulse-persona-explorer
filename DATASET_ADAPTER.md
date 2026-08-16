# Dataset Adapter Contract

**Civic Pulse** reads personas through a small adapter boundary rather than tying screens or prompts directly to a vendor-specific schema. The default configuration uses a sampled subset of [NVIDIA Nemotron-Personas-USA](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA), a CC BY 4.0 dataset that NVIDIA describes as fully synthetic and grounded against aggregate U.S. distributions.

> The source data is not a survey. Responses produced by Civic Pulse are additional synthetic AI outputs and must not be interpreted as measured opinion, prediction, or evidence about real people.

## Required normalized fields

| Field | Type | Requirement | Notes |
| --- | --- | --- | --- |
| `id` | string | Required | Stable, dataset-scoped identifier. |
| `name` | string | Required | Synthetic display name or neutral label. |
| `age` | number | Required | Integer in years. |
| `sex` | string | Required | Displayable demographic value. |
| `state` | string | Required for U.S. map | Two-letter jurisdiction code. |
| `region` | string | Required | Geographic grouping used by filters and charts. |
| `occupation` | string | Required | Normalized human-readable label. |
| `educationLevel` | string | Required | Normalized human-readable label. |
| `maritalStatus` | string | Required | Normalized human-readable label. |
| `personaNarrative` | string | Required | Primary biographical context for the AI prompt. |
| `professionalBackground` | string | Recommended | Additional grounding text. |
| `culturalBackground` | string | Recommended | Additional grounding text. |
| `hobbiesAndInterests` | string | Recommended | Additional grounding text. |
| `careerGoals` | string | Recommended | Additional grounding text. |
| `incomeTier` | string | Optional | Use `Not modeled` when absent; never infer it from a proxy. |
| `politicalLean` | string | Optional | Use `Not modeled` when absent; never infer it from demographics or location. |

## Replacing the active dataset

The owner settings screen accepts a metadata configuration and public JSON endpoint. A replacement dataset must provide a JSON array of normalized records plus a metadata document that lists filter options, the age range, source URL, license, coverage, and which fields are unavailable. The `normalizePersona` function in `shared/personas.ts` is the only place vendor-specific field mapping belongs. This protects the simulation API, filters, map, and cards from source-schema changes.

## Default-source limitations

The default NVIDIA source exposes demographics, location, occupation, education, marital status, and several detailed biographical text fields. It does **not** publish income tier or political lean. Civic Pulse therefore makes these filters visible as unavailable dimensions labeled `Not modeled` in the default dataset. An owner may supply a compatible, transparently documented dataset that has those attributes; Civic Pulse will then expose the values without modeling or guessing them.

