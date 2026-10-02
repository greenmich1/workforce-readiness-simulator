"use client";
import { useRef, useState } from "react";
import { NZ, nzPoint } from "@/lib/nz";
import { SITES, kindLabel, presetFor, type Site } from "@/lib/sites";

/**
 * The front screen (2026-10-02): choose a site, then schedule its people. Replaces the old
 * "Stop Scheduling Manually" landing. Sites are public places; the workforce is illustrative.
 */
export default function ChooseSite() {
  const [tab, setTab] = useState<"manufacturing" | "office">("manufacturing");
  const [pick, setPickState] = useState<Site | null>(null);
  const aside = useRef<HTMLElement>(null);
  // On a phone the card sits under the map, so bring it into view once a site is chosen.
  const setPick = (s: Site | null) => {
    setPickState(s);
    if (s && window.matchMedia("(max-width:820px)").matches) requestAnimationFrame(() => aside.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const list = SITES.filter((s) => (tab === "office" ? s.kind === "office" : s.kind !== "office"));
  const card: React.CSSProperties = { background: "var(--glass)", backdropFilter: "var(--blur)", border: "1px solid rgba(255,255,255,.9)", borderRadius: 14, boxShadow: "var(--shadow)" };

  return (
    <main style={{ minHeight: "100vh", paddingTop: 40, background: "radial-gradient(120% 90% at 55% 38%,#FFFFFF 0%,#F3F3EF 55%,#E6E7E3 100%) " }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 48px" }}>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 44, letterSpacing: "-0.015em", margin: 0 }}>Enterprise Scheduler</h1>
        <p style={{ fontSize: 17, color: "var(--ink-2)", margin: "8px 0 24px", maxWidth: 680 }}>
          Choose a site of a New Zealand dairy manufacturer-exporter, then let a CP-SAT solver schedule its people&apos;s training around their shifts.
        </p>
        <div className="ops-seg" role="group" aria-label="Kind of site" style={{ display: "inline-flex", marginBottom: 20 }}>
          <button aria-pressed={tab === "manufacturing"} onClick={() => { setTab("manufacturing"); setPick(null); }}>Manufacturing</button>
          <button aria-pressed={tab === "office"} onClick={() => { setTab("office"); setPick(null); }}>In-market offices</button>
        </div>

        {/* Map and card side by side; stacked on a phone. */}
        <style>{`.es-pick{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:20px;align-items:start}
          .es-pick g[role=button]:focus{outline:none}.es-pick g[role=button]:focus-visible circle{stroke:#0B2545}
          @media (max-width:820px){.es-pick{grid-template-columns:1fr}.es-pick aside{position:static!important}}`}</style>
        <div className="es-pick">
          {tab === "manufacturing" ? (
            <div style={{ ...card, padding: 16 }}>
              <svg viewBox={`-10 -10 ${NZ.w + 20} ${NZ.h + 20}`} style={{ width: "100%", maxHeight: "max(420px, calc(100vh - 330px))", display: "block" }} role="group" aria-label="Map of New Zealand with the manufacturing sites">
                <path d={NZ.d} fill="#E3EDF7" stroke="#9DB7D1" strokeWidth={1} />
                {list.map((s) => {
                  const p = nzPoint(s.lon, s.lat), on = pick?.id === s.id;
                  return (
                    <g key={s.id} onClick={() => setPick(s)} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${s.name}, ${s.place}`}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPick(s); }}>
                      <circle cx={p.x} cy={p.y} r={on ? 8 : s.scale === "large" ? 6 : 4.5} fill={s.kind === "research" ? "#5A3FD4" : "#00539B"} stroke="#fff" strokeWidth={2} />
                    </g>
                  );
                })}
                {/* Labels last, so no dot paints over them. */}
                {list.map((s) => {
                  const p = nzPoint(s.lon, s.lat), on = pick?.id === s.id;
                  return <g key={s.id} style={{ pointerEvents: "none" }}>{(on || s.scale === "large") && <text x={p.x + 10} y={p.y + 4} fontSize={12} fontFamily="Figtree" fontWeight={600} fill="#0B2545" stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{s.name}</text>}</g>;
                })}
              </svg>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {list.map((s) => (
                <button key={s.id} onClick={() => setPick(s)} style={{ ...card, padding: "14px 16px", textAlign: "left", cursor: "pointer", outline: pick?.id === s.id ? "2px solid #00539B" : "none" }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{s.region}</div>
                </button>
              ))}
            </div>
          )}

          <aside ref={aside} style={{ ...card, padding: 20, position: "sticky", top: 56 }}>
            {pick ? (
              <>
                <div className="ops-eyebrow">{kindLabel(pick)}</div>
                <h2 style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 26, margin: "6px 0 2px" }}>{pick.name}</h2>
                <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 14 }}>{pick.place}, {pick.region}</div>
                <div className="ops-eyebrow" style={{ marginBottom: 4 }}>Illustrative workforce</div>
                <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 18px" }}>{presetFor(pick).summary}</p>
                <a className="ops-btn ops-btn-primary" href={`/app?site=${pick.id}`} style={{ width: "100%" }}>Open the scheduler</a>
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12 }}>Places are public; the people and courses are generated.</p>
              </>
            ) : (
              <>
                <div className="ops-eyebrow">{list.length} {tab === "office" ? "offices" : "sites"}</div>
                <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.45, marginTop: 8 }}>
                  {tab === "office" ? "Pick an office to schedule its sales and service team." : "Pick a site on the map. The largest are named; any dot opens."}
                </p>
                <a className="ops-btn ops-btn-ghost" href="/app" style={{ marginTop: 8 }}>Or start with a blank workforce</a>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
