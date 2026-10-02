"use client";
import { useEffect, useRef, useState } from "react";
import { SITES, presetFor, profileFacts, type Site } from "@/lib/sites";

/**
 * The front screen (2026-10-03): every site and office as a tile with an icon for what it is. Choosing
 * one shows what the site is and the training profile inferred for it; "Generate the schedule" opens
 * the scheduler, which builds that workforce at once (no settings to fill in). Places are public; the
 * workforce is illustrative.
 */

/** Line icons for the three kinds of place, plus a larger plant for the major sites. */
function SiteIcon({ site, size = 40 }: { site: Site; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 40 40", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (site.kind === "office") return (
    <svg {...common}>
      <rect x="11" y="7" width="18" height="27" rx="1.5" />
      <path d="M15 12h3M22 12h3M15 17h3M22 17h3M15 22h3M22 22h3M18 34v-5h4v5M6 34h28" />
    </svg>
  );
  if (site.kind === "research") return (
    <svg {...common}>
      <path d="M16 6h8M17.5 6v10L9 31a2 2 0 0 0 1.8 3h18.4a2 2 0 0 0 1.8-3L22.5 16V6" />
      <path d="M12.5 25h15" /><circle cx="18" cy="29" r="1" /><circle cx="23" cy="28" r="1.2" />
    </svg>
  );
  if (site.scale === "large") return (
    <svg {...common}>
      {/* A spray-dryer tower beside the plant */}
      <path d="M5 34h30M7 34V20l6 4v-4l6 4v-4l6 4v10" />
      <path d="M27 34V12l2.5-5L32 12v22" /><path d="M27 18h5M27 24h5" />
      <path d="M11 29h2M17 29h2" />
    </svg>
  );
  return (
    <svg {...common}>
      <path d="M5 34h30M7 34V20l7 4.5V20l7 4.5V20l7 4.5V34" />
      <path d="M30 34V11h3v23" /><path d="M31.5 8v-1" />
      <path d="M12 29h2M19 29h2" />
    </svg>
  );
}

export default function ChooseSite() {
  const [tab, setTab] = useState<"manufacturing" | "office">("manufacturing");
  const [pick, setPick] = useState<Site | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const list = SITES.filter((s) => (tab === "office" ? s.kind === "office" : s.kind !== "office"));
  // Group by region (island order is kept from the data), so the tiles read north to south.
  const groups = list.reduce<[string, Site[]][]>((g, s) => {
    const last = g[g.length - 1];
    if (last && last[0] === s.region) last[1].push(s); else g.push([s.region, [s]]);
    return g;
  }, []);

  const open = (s: Site, el: HTMLElement) => { opener.current = el; setPick(s); };
  const close = () => { setPick(null); opener.current?.focus(); };

  useEffect(() => {
    if (!pick) return;
    dialog.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  const preset = pick && presetFor(pick);

  return (
    <main style={{ minHeight: "100dvh", paddingTop: 40, background: "radial-gradient(120% 90% at 55% 20%,#FFFFFF 0%,#F3F3EF 55%,#E6E7E3 100%)" }}>
      <style>{`
        .es-wrap{max-width:1180px;margin:0 auto;padding:40px 24px 56px}
        .es-title{font-family:var(--display);font-weight:600;font-size:44px;letter-spacing:-0.015em;margin:0}
        .es-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
        .es-tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:16px;text-align:left;cursor:pointer;
          background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid rgba(255,255,255,.9);
          border-radius:14px;box-shadow:var(--shadow);color:var(--ink);font:inherit;transition:transform .15s ease,box-shadow .15s ease}
        .es-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow-lift)}
        .es-tile:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
        .es-tile .ic{color:var(--blue)} .es-tile.rnd .ic{color:var(--uv)}
        .es-region{font-size:12px;font-weight:600;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase;margin:22px 0 10px}
        .es-scrim{position:fixed;inset:0;z-index:1100;background:rgba(11,37,69,.28);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
          display:flex;align-items:center;justify-content:center;padding:16px;animation:es-fade .18s ease}
        .es-dialog{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:rgba(255,255,255,.96);border-radius:20px;
          box-shadow:0 24px 80px rgba(11,37,69,.25);padding:24px;animation:es-rise .22s cubic-bezier(.2,.8,.2,1)}
        .es-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 20px}
        .es-facts div{background:var(--well);border-radius:10px;padding:9px 11px}
        .es-facts dt{font-size:12px;color:var(--ink-3)} .es-facts dd{margin:2px 0 0;font-weight:600;font-size:15px}
        .es-facts .wide{grid-column:1/-1}
        @keyframes es-fade{from{opacity:0}} @keyframes es-rise{from{opacity:0;transform:translateY(16px)}}
        @media (max-width:640px){
          .es-wrap{padding:28px 16px 40px} .es-title{font-size:34px}
          .es-tiles{grid-template-columns:1fr 1fr;gap:8px} .es-tile{padding:14px 12px}
          .es-scrim{align-items:flex-end;padding:0}
          .es-dialog{width:100%;border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));max-height:88dvh}
        }
        @media (prefers-reduced-motion:reduce){.es-scrim,.es-dialog{animation:none}.es-tile{transition:none}}
      `}</style>

      <div className="es-wrap">
        <h1 className="es-title">Enterprise Scheduler</h1>
        <p style={{ fontSize: 17, color: "var(--ink-2)", margin: "8px 0 24px", maxWidth: 680, lineHeight: 1.5 }}>
          Choose a site of a New Zealand dairy manufacturer-exporter. A CP-SAT solver schedules its people&apos;s training around their shifts.
        </p>
        <div className="ops-seg" role="group" aria-label="Kind of site" style={{ display: "inline-flex" }}>
          <button aria-pressed={tab === "manufacturing"} onClick={() => setTab("manufacturing")}>Manufacturing</button>
          <button aria-pressed={tab === "office"} onClick={() => setTab("office")}>In-market offices</button>
        </div>

        {groups.map(([region, sites]) => (
          <section key={region} aria-label={region}>
            <h2 className="es-region">{region}</h2>
            <div className="es-tiles">
              {sites.map((s) => (
                <button key={s.id} className={`es-tile${s.kind === "research" ? " rnd" : ""}`} onClick={(e) => open(s, e.currentTarget)} aria-haspopup="dialog">
                  <span className="ic"><SiteIcon site={s} /></span>
                  <span>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 16, lineHeight: 1.25 }}>{s.name}</span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                      {s.kind === "office" ? s.region : s.place}{s.scale === "large" ? " · major site" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 28 }}>
          Places are public. The people, roles and courses behind each one are generated from an inferred profile.
        </p>
      </div>

      {pick && preset && (
        <div className="es-scrim" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialog} className="es-dialog" role="dialog" aria-modal="true" aria-labelledby="es-dlg-title">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <span style={{ color: pick.kind === "research" ? "var(--uv)" : "var(--blue)", background: "var(--blue-soft)", borderRadius: 14, padding: 8, display: "flex" }}>
                <SiteIcon site={pick} size={36} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ops-eyebrow">{pick.kind === "office" ? "In-market sales office" : pick.kind === "research" ? "Research and development" : pick.scale === "large" ? "Major manufacturing site" : "Manufacturing site"}</div>
                <h2 id="es-dlg-title" style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 28, margin: "4px 0 2px", lineHeight: 1.1 }}>{pick.name}</h2>
                <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{pick.place}, {pick.region}</div>
              </div>
              <button onClick={close} aria-label="Close" className="ops-btn ops-btn-ghost" style={{ padding: "6px 10px", minWidth: 0 }}>✕</button>
            </div>

            {pick.makes && <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 8px" }}><strong style={{ fontWeight: 600 }}>Makes</strong> {pick.makes.charAt(0).toLowerCase() + pick.makes.slice(1)}.</p>}
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.5, margin: "0 0 16px" }}>{preset.summary}</p>
            <div className="ops-eyebrow" style={{ marginBottom: 8 }}>Inferred training profile</div>
            <dl className="es-facts">
              {profileFacts(preset).map(([k, v]) => (
                <div key={k} className={k === "Rosters" ? "wide" : undefined}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <a className="ops-btn ops-btn-primary" href={`/app?site=${pick.id}`} style={{ width: "100%", padding: "12px 16px", fontSize: 15 }}>Generate the schedule</a>
          </div>
        </div>
      )}
    </main>
  );
}
