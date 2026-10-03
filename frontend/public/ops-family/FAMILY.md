# The SAP & AI family

One design language for **Dairy Twin**, **Maritime OS** and **Enterprise Scheduler**: three views of
the same manufacturer-exporter (its people, its plant, its order book at sea). Dairy Twin is the
reference. Decided 2026-10-02.

Canonical files live in `greenwell/shared/ops-family/` and are copied into each repo by
`greenwell/scripts/sync_family.sh`. Edit the canonical copy, sync, and commit in each repo.

| File | Use |
| --- | --- |
| `family.css` | Tokens (colour, type, shape) and base pieces: `.ops-card`, `.ops-kpi`, `.ops-chip`, `.ops-btn`, `.ops-seg`, `.num` |
| `fonts.html` | The one font link (Newsreader, Figtree, JetBrains Mono); Next.js uses `next/font` for the same three |
| `ops-suite.js` | `<ops-suite current="…">`: the 40 px header linking the three apps, with "← Situation Room" back to the Greenwell room they hang off (`room="…"`, default `situation`; `ROOMS` in the file) |

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

Enterprise Scheduler opens on **Choose a site** (tiles with an icon per kind of place, 2026-10-03).
Its sites and offices (`frontend/lib/sites.ts`) are a New Zealand dairy co-operative's manufacturing
sites and in-market offices, taken from the co-operative's own public contact pages (checked
2026-10-02); the company is not named. Choosing one shows the training profile inferred for it
(`presetFor`: by kind and scale, varied a little per site), and the scheduler generates that
workforce at once; there are no settings to fill in. The people, roles and courses are synthetic.
