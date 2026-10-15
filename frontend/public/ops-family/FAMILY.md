# The SAP & AI family

One design language for **Plan**, **Collect**, **Dairy Twin**, **Seal Sentinel**, **Maritime OS** and **Enterprise Scheduler**:
views of the same manufacturer-exporter (its season, its milk, its plant, its line cameras, its order book at sea,
its people). Dairy Twin is the reference. Decided 2026-10-02; six apps since 2026-10-15.

Canonical files live in `greenwell/shared/ops-family/` and are copied into each repo by
`greenwell/scripts/sync_family.sh`. Edit the canonical copy, sync, and commit in each repo.

| File | Use |
| --- | --- |
| `family.css` | Tokens (colour, type, shape, the AI scope tier colours) and base pieces: `.ops-card`, `.ops-kpi`, `.ops-chip`, `.ops-btn`, `.ops-seg`, `.num`; the scope dial (`.ops-scope…`), the Value index card (`.ops-value…`) and the hand-off link (`.ops-handoff`) |
| `shell.css` | The simulations' shared app shell (Plan, Collect, Dairy Twin; 2026-10-15): the bar under the header (brand, run controls, views, clock, KPI chips), panels, sections, tabs, decision cards, steps, options, the SAP panes, the timeline and the phone layout at 1000 px. Link `family.css` first, then this, then the app's own rules |
| `ai-scope.js` | The family's one AI scope control, the Dairy Twin's dial (`mountScope`), and the Value index card (`valueCard`, `valueIndex`) |
| `family.js` | The apps (`APPS`), the one today (`TODAY`, `dayLabel`) and the hand-offs (`handoffURL`, `readHandoff`, `applied`) |
| `fonts.html` | The one font link (Newsreader, Figtree, JetBrains Mono); Next.js uses `next/font` for the same three |
| `ops-suite.js` | `<ops-suite current="…">`: the 40 px header linking the apps (Plan, Collect, Dairy Twin, Seal Sentinel, Maritime OS, then Enterprise Scheduler, always last), with "← SAP Autonomous Enterprise" back to the Greenwell room they hang off (`room="…"`, default `situation`; `ROOMS` in the file). It also shows an arriving hand-off: a chip, "From Plan · …", and a card with the trail |

## AI scope, in every app (owner, 2026-10-15)

- Three tiers, each adding to the one before: **SAP AI** (only what SAP has published: Joule, Joule agents, embedded AI), **+ MyWave** (MyWave catalogue agents, mywaveagent.ai, for jobs SAP has no agent for; never a duplicate of an SAP agent) and **+ Gap-fill** (the art of the possible). Default: SAP AI.
- Every agent is declared with its tier and a source. An out-of-scope agent's steps fall back to SAP's deterministic rules or leave a gap card. Hard limits stay rules at every tier.
- One control everywhere: the Dairy Twin's dial with "Compare tiers" under it (`ai-scope.js`).
- **The Value index**, not money: 0–100, where 100 means every measure at its ideal; the plain mean of a module's three or four measures, each a percentage of its ideal. It is the first KPI chip in each bar, and "Compare tiers" shows it per scope with its measures and a finding in plain words. Money stays only where it is accounting.

| App | Agents by tier | Measures |
|---|---|---|
| Plan | `plan/data/agents/catalog.json` | value from the milk (of perfect foresight), contracts met, plan matched the milk, warning time |
| Collect | `collect/js/agents.js` (Logistics Assistant; SC-010, SC-015, SC-037; Food Safety Guardian, Rolling Re-planner) | vats collected before they fill, milk within 6 hours, distance to the morning plan, warning time (precomputed: `tools/compare-tiers.mjs`) |
| Dairy Twin | `dairy-twin/data/agents/catalog.json` | production to plan, orders confirmed, protein on target, power bought off-peak |
| Seal Sentinel | `seal-sentinel/js/tiers.js` (Production Excellence Agent; SC-015, MFG-013; Line Root-Cause) | packs dispatched sound, good packs kept moving, line running, faults fixed at the source (a station-drift replay) |
| Maritime OS | `frontend/src/domain/aiScope.ts` (core due-date check; Business Network Assistant; TF-025, TF-022, TF-024; Export Window) | value at risk with a decision, promises covered, risks with an owner, warning time, against the full watch |
| Enterprise Scheduler | `frontend/lib/aiScope.ts` (Joule; MFG-004, XF-015; Readiness Planner) | training scheduled, no clashes, days away from the line, classes well filled |

## One today, and hand-offs (owner, 2026-10-15)

- Every simulated app runs **Wednesday 14 October 2026** (`family.js` `TODAY`). Maritime OS stays on real time: its vessels are live.
- A hand-off travels in the link (the apps are on different domains): `#handoff=<base64url JSON>` with `{ v: 1, from, to, kind, title, detail, params, trail }`. The header shows it; an app that understands `kind` applies it and calls `applied(text)`.
- The chain today: Plan's Te Rapa dryer outage → Collect (`outage`: the intake closes, the tankers divert) → Dairy Twin (`dryerFault`); Collect's storm → Dairy Twin (`lateTanker`); the Dairy Twin's urgent order → Seal Sentinel (`product`) and Maritime OS (`order`, shown); Seal Sentinel's held stock → Maritime OS (`hold`, shown).

## The language

- **Ground:** milk `#F6F5F1`, with frosted white cards (`.ops-card`): 14 px radius, a hairline, and a
  soft navy-tinted shadow. Depth comes from translucency and shadow, never from heavy borders.
- **Ink:** one navy `#0B2545`, in three strengths. No pure black text.
- **Action:** co-op blue `#00539B`, one primary button per view. Focus is sky `#00AEEF`.
- **Agents and AI suggestions:** ultraviolet `#5A3FD4`, so the user always sees what the machine
  proposed.
- **Type:**
  - Newsreader for names and titles;
  - Figtree for everything you read or press;
  - JetBrains Mono, tabular, for every number, time, ID and code.
- **States:** ok, warn, alert and AI are always a colour *and* a word (`.ops-chip`), never colour alone.
- **Night** (`data-theme="night"`): the same roles on deep navy. It is an option, never the default.

## Do and don't

| Do | Don't |
| --- | --- |
| Serif for the app name and section titles | Serif for data, labels or buttons |
| Mono, tabular, for numbers (`.num`, `.ops-kpi b`) | Proportional digits in tables and KPIs |
| Small capitals only for eyebrows and KPI labels | All-caps paragraphs or console-style capitals everywhere |
| Status as a chip with a word | A coloured dot with no label |
| White cards floating over the work (plant, globe, schedule) | Dark glass panels, neon accents, cyan glows |
| Real place names where they help | A company's name, logo or brand in anything published |
| Calm motion: fades, lifts, eased camera moves | Gradient text, blobs, emoji icons, sunset backdrops |

## The shared story

The three are one company's chain:
- the people trained in **Enterprise Scheduler** run the plant in **Dairy Twin**;
- the plant's powder and butter ship as orders tracked in **Maritime OS**.

Where it fits, each app links to the others at the point the story crosses: a site's plant, a product's
shipment, an agent's schedule.

## Where each app lives

| App | Repo (path under `~/Developer`) | Live |
|---|---|---|
| Dairy Twin | `dairy-twin` | https://dairy-twin.vercel.app/ |
| Maritime OS | `maritime-intel-os` (`frontend/`) | Vercel, from `main` |
| Enterprise Scheduler | `workforce-readiness-simulator/v0.2-Claude` (`frontend/`; **public** repo) | https://workforce-readiness-simulator.vercel.app/ |
| Collect | `greenwell/collect` (own git repo; header only) | https://milk-collect-nine.vercel.app/ (2026-10-09; tabs now in pipeline order) |
| Seal Sentinel (Vision Room) | `greenwell/seal-sentinel` (own git repo; porcelain since 2026-10-13) | https://seal-sentinel.vercel.app/ (live 2026-10-04, in the Situation Room). Its tab is in every app's header (synced and redeployed 2026-10-04). An app marked `live: false` in `APPS` shows only on its own page |

Enterprise Scheduler opens on **Choose a site** (tiles with an icon per kind of place, 2026-10-03).
Its sites and offices (`frontend/lib/sites.ts`) are a New Zealand dairy co-operative's manufacturing
sites and in-market offices, taken from the co-operative's own public contact pages (checked
2026-10-02); the company is not named. Choosing one shows the training profile inferred for it
(`presetFor`: by kind and scale, varied a little per site), and the scheduler generates that
workforce at once; there are no settings to fill in. The people, roles and courses are synthetic.
