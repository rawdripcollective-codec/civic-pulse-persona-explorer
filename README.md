# Civic Pulse — Interactive Persona Explorer

Civic Pulse is a configurable full-stack research interface that lets users pose civic questions to a selected group of **fully synthetic personas** and watch AI-generated, illustrative viewpoints accumulate across demographics and U.S. geography.

> **Important:** Civic Pulse is a simulation, not a poll. Neither its source profiles nor generated answers are real-person data, measured public opinion, population estimates, or evidence for decision-making.

## Live preview

Use the project preview in the application workspace during development. After creating a release checkpoint, publish through the workspace’s **Publish** control to obtain a stable live URL.

## Features

| Area | Included capabilities |
| --- | --- |
| Synthetic persona data | Loads a curated, normalized subset of NVIDIA Nemotron-Personas-USA with age, sex, geography, work, education, marital status, and rich biographical context. |
| Transparent provenance | A persistent synthetic-output disclosure, dataset trust label, source link, license, and data-methodology panel. |
| AI response simulation | Server-side LLM requests generate short first-person responses in sequential 10 / 20 / remainder waves, with card-by-card delivery. |
| Geospatial exploration | MapLibre state choropleth with a dark 3D terrain treatment, dynamic sentiment coloring, hover counts, dominant sentiment, and state selection. |
| Audience selection | Filters for age, sex, education, region, state, sample size, income tier, and political lean. Unavailable source dimensions are labelled rather than inferred. |
| Analytics | Recharts donut and stacked-bar views for overall sentiment and age, education, region, and occupation breakdowns. |
| History | Browser session history plus database-backed result snapshots allow users to revisit prior simulations. |
| Configuration | Owner settings support alternative persona endpoints, alternate metadata/boundary endpoints, question-domain labels, and geographic visualization control. |

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| Maps | MapLibre GL JS, CARTO Dark Matter base styling, public state boundary GeoJSON |
| Charts | Recharts |
| Backend | Express 4, tRPC 11, Zod |
| Persistence | Drizzle ORM and MySQL/TiDB-compatible database |
| Testing | Vitest |
| Package manager | pnpm |

## How it works

1. The browser downloads the active persona JSON and metadata endpoint configured in the owner settings.
2. The app filters the loaded synthetic personas, selects up to the configured sample size, and divides the sample into 10 / 20 / remainder response waves.
3. Each wave is split into batches of up to five persona contexts and sent from the server to the configured LLM service. The model is required to return structured JSON with an answer and exactly one of `positive`, `neutral`, or `negative`.
4. Response cards reveal gradually, while sentiment summaries, charts, and state-level map properties update from the accumulated results.
5. A compact result snapshot is stored under a browser session identifier so the simulation can be restored later without rerunning it.

## Dataset and provenance

The default experience uses a 240-record sample drawn directly from **[NVIDIA Nemotron-Personas-USA](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA)**. NVIDIA describes the collection as a fully synthetic dataset grounded against aggregate U.S. Census and BLS distributions; its dataset page lists the license as **CC BY 4.0**. The source provides detailed demographic, geographic, professional, cultural, interest, and ambition fields. It does not publish political lean or income tier. Civic Pulse therefore displays those two dimensions as **Not modeled** and never guesses them from location, occupation, demographics, or language.[1] [2]

State boundaries are served from the PublicaMundi U.S. state GeoJSON dataset for map visualization.[3]

## Dataset adapter

The app keeps vendor-specific schema logic at the adapter boundary in `shared/personas.ts`. It expects a normalized persona array and metadata JSON. Replacement datasets should document their provenance, license, geographic scope, available dimensions, and restrictions. Read [`DATASET_ADAPTER.md`](./DATASET_ADAPTER.md) for required fields, unavailable-field treatment, and exact swap instructions.

## Development setup

```bash
pnpm install
pnpm dev
```

Run validation and tests with:

```bash
pnpm check
pnpm test
pnpm build
```

## Environment variables

The managed project environment supplies these values. Do not commit `.env` files.

| Variable | Purpose |
| --- | --- |
| `BUILT_IN_FORGE_API_URL` | Server-side LLM gateway base URL. |
| `BUILT_IN_FORGE_API_KEY` | Server-side LLM gateway credential. |
| `DATABASE_URL` | MySQL/TiDB connection string for saved history. |
| `JWT_SECRET` | Session signing support for the included authentication framework. |
| `VITE_FRONTEND_FORGE_API_URL` | Managed client integration gateway base URL. |
| `VITE_FRONTEND_FORGE_API_KEY` | Managed client integration credential. |

## Design and safety notes

The interface deliberately foregrounds provenance and scope limitations. Generated answers are context-aware synthetic outputs rather than validated opinion measurements. The LLM prompt explicitly rejects claims that the output represents a real individual or population consensus. If LLM output is unavailable or invalid, Civic Pulse returns a neutral, contextual fallback instead of silently inventing an unsupported result.

## License

This application is released under the [MIT License](./LICENSE). The included dataset is governed separately by its stated **CC BY 4.0** terms.

## References

[1] [NVIDIA Nemotron-Personas-USA dataset](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA)

[2] [NVIDIA, *Nemotron-Personas-USA: Synthesized Data for Sovereign AI*](https://huggingface.co/blog/nvidia/nemotron-personas-usa)

[3] [PublicaMundi, U.S. states GeoJSON](https://github.com/PublicaMundi/MappingAPI/blob/master/data/geojson/us-states.json)
