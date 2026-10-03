"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { presetFor, profileFacts, type Site } from "@/lib/sites";
import { REGIONS, type Mode, type Region } from "@/lib/regions";
import type { GlobeHandle } from "@/components/globe/SiteGlobe";

const SiteGlobe = dynamic(() => import("@/components/globe/SiteGlobe"), { ssr: false });

/**
 * The front screen (2026-10-03, second version): the Maritime OS globe on the left, the regions as glass
 * cards on the right. Hovering a card flies the globe there and draws a line to it; opening one lists
 * its sites (Northland → Kauri, Maungatūroto). Choosing a site shows the training profile inferred for
 * it, and "Generate the schedule" opens the scheduler, which builds that workforce at once. The offices
 * view pulls back to the export arcs from the major plants. Left alone, the globe tours the regions.
 * Places are public; the workforce is illustrative.
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
  const [tab, setTab] = useState<Mode>("manufacturing");
  const [openId, setOpenId] = useState<string | null>(null);
  const [hover, setHover] = useState<Region | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [tour, setTour] = useState<Region | null>(null);
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState<Site | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phone, setPhone] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const globe = useRef<GlobeHandle>(null);
  const lead = useRef<SVGPathElement>(null);
  const leadDot = useRef<SVGCircleElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const regions = REGIONS[tab];
  const open = regions.find((r) => r.id === openId) ?? null;
  const view = hover ?? tour ?? open;
  const maxPeople = Math.max(...regions.map((r) => r.people));

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ph = window.matchMedia("(max-width: 899px), (pointer: coarse)");
    const sync = () => { setReducedMotion(rm.matches); setPhone(ph.matches); };
    sync();
    rm.addEventListener("change", sync); ph.addEventListener("change", sync);
    return () => { rm.removeEventListener("change", sync); ph.removeEventListener("change", sync); };
  }, []);

  /** Hovering flies the globe, after a beat, so sweeping the pointer down the list doesn't whip it about. */
  const hoverTo = (r: Region | null, delay = 140) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(r), delay);
  };

  const switchTab = (m: Mode) => { setTab(m); setOpenId(null); setHover(null); setHot(null); setTour(null); };

  const openSite = (s: Site, el: HTMLElement | null) => { opener.current = el; setTour(null); setPick(s); };
  const close = () => { setPick(null); opener.current?.focus(); };

  /** A pin clicked on the globe: open its region's card and its dialog. */
  const pickFromGlobe = (id: string) => {
    const r = regions.find((x) => x.sites.some((s) => s.id === id));
    const s = r?.sites.find((x) => x.id === id);
    if (!r || !s) return;
    setOpenId(r.id);
    openSite(s, document.querySelector<HTMLElement>(`[data-site="${id}"]`));
  };

  useEffect(() => {
    if (!pick) return;
    dialog.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  // The idle tour: after 20 s with no input the globe visits each region in turn. Any input ends it.
  useEffect(() => {
    if (reducedMotion || phone || pick) { setTour(null); return; }
    let idle: ReturnType<typeof setTimeout>;
    let step: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(step); step = undefined;
      setTour(null);
      clearTimeout(idle);
      idle = setTimeout(start, 20_000);
    };
    const start = () => {
      if (document.hidden) { idle = setTimeout(start, 20_000); return; }
      let i = 0;
      setTour(regions[0]);
      step = setInterval(() => { i = (i + 1) % regions.length; setTour(regions[i]); }, 6_000);
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, stop, { passive: true, capture: true }));
    idle = setTimeout(start, 20_000);
    return () => { clearTimeout(idle); clearInterval(step); events.forEach((e) => window.removeEventListener(e, stop, { capture: true })); };
  }, [reducedMotion, phone, pick, regions]);

  // The leader line: from the card (or site row) to its pin, redrawn each frame while the globe moves.
  const target = hot ? { key: `site:${hot}`, ...(regions.flatMap((r) => r.sites).find((s) => s.id === hot) ?? { lat: 0, lon: 0 }) }
    : (hover ?? tour) ? { key: (hover ?? tour)!.id, lat: (hover ?? tour)!.lat, lon: (hover ?? tour)!.lon } : null;
  useEffect(() => {
    const path = lead.current, dot = leadDot.current;
    if (!path || !dot) return;
    if (!target || phone) { path.style.opacity = "0"; dot.style.opacity = "0"; return; }
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const el = document.querySelector<HTMLElement>(`[data-lead="${CSS.escape(target.key)}"]`);
      const p = globe.current?.project(target.lat, target.lon);
      if (!el || !p) { path.style.opacity = "0"; dot.style.opacity = "0"; return; }
      const r = el.getBoundingClientRect();
      const x1 = r.left - 6, y1 = r.top + r.height / 2;
      const mx = (x1 + p.x) / 2;
      path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${p.y} ${p.x},${p.y}`);
      dot.setAttribute("cx", String(p.x)); dot.setAttribute("cy", String(p.y));
      path.style.opacity = "1"; dot.style.opacity = "1";
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [target?.key, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Arrow keys move between the region cards. */
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const heads = Array.from(document.querySelectorAll<HTMLElement>(".es-head"));
    const i = heads.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    heads[(i + (e.key === "ArrowDown" ? 1 : heads.length - 1)) % heads.length]?.focus();
  };

  const preset = pick && presetFor(pick);

  return (
    <main style={{ minHeight: "100dvh", paddingTop: 40, background: "radial-gradient(120% 90% at 30% 35%,#FFFFFF 0%,#F3F3EF 55%,#E6E7E3 100%)" }}>
      <style>{`
        .es-stage{display:grid;grid-template-columns:minmax(0,58fr) minmax(400px,42fr);height:calc(100dvh - 40px)}
        .es-globe{position:relative;overflow:hidden}
        .es-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .8s ease;pointer-events:none}
        .es-credits{position:absolute;left:12px;bottom:10px;font-size:10px;color:var(--ink-2);background:rgba(255,255,255,.72);border-radius:6px;padding:2px 7px;max-width:70%}
        .es-credits .cesium-credit-logoContainer{display:none!important}
        .es-credits a{color:inherit}
        .es-panel{overflow:auto;padding:44px 40px 40px 8px;scrollbar-width:thin}
        .es-title{font-family:var(--display);font-weight:600;font-size:46px;letter-spacing:-0.015em;line-height:1.02;margin:6px 0 0}
        .es-regions{display:flex;flex-direction:column;gap:10px;margin-top:22px}
        .es-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid rgba(255,255,255,.95);
          border-radius:16px;box-shadow:var(--shadow);transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease}
        .es-card.on{box-shadow:var(--shadow-lift),0 0 0 1px rgba(0,174,239,.35);transform:translateX(-4px)}
        .es-card.tour{box-shadow:var(--shadow-lift),0 0 0 2px rgba(0,174,239,.45)}
        .es-head{display:flex;align-items:center;gap:14px;width:100%;padding:15px 16px;background:none;border:0;text-align:left;font:inherit;color:var(--ink);cursor:pointer;border-radius:16px}
        .es-head:focus-visible,.es-row:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
        .es-name{font-weight:600;font-size:17px;line-height:1.2}
        .es-stat{font-size:13px;color:var(--ink-3);margin-top:3px}
        .es-bar{height:4px;border-radius:2px;background:rgba(11,37,69,.07);margin-top:9px;overflow:hidden}
        .es-bar i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,var(--blue),var(--sky))}
        .es-chev{margin-left:auto;color:var(--ink-3);transition:transform .2s ease;flex:none}
        .es-card[data-open="true"] .es-chev{transform:rotate(90deg)}
        .es-sites{display:grid;gap:4px;padding:0 10px 10px}
        .es-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border:0;border-radius:11px;background:transparent;text-align:left;font:inherit;color:var(--ink);cursor:pointer}
        .es-row:hover,.es-row.hot{background:var(--paper);box-shadow:0 1px 3px rgba(11,37,69,.10)}
        .es-row .ic{color:var(--blue);flex:none} .es-row.rnd .ic{color:var(--uv)}
        .es-tag{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);background:var(--blue-soft);border-radius:6px;padding:2px 6px;margin-left:6px;vertical-align:1px}
        .es-lead{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:5}
        .es-lead path,.es-lead circle{transition:opacity .2s ease}
        .es-scrim{position:fixed;inset:0;z-index:1100;background:rgba(11,37,69,.28);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
          display:flex;align-items:center;justify-content:center;padding:16px;animation:es-fade .18s ease}
        .es-dialog{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:rgba(255,255,255,.96);border-radius:20px;
          box-shadow:0 24px 80px rgba(11,37,69,.25);padding:24px;animation:es-rise .22s cubic-bezier(.2,.8,.2,1)}
        .es-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 20px}
        .es-facts div{background:var(--well);border-radius:10px;padding:9px 11px}
        .es-facts dt{font-size:12px;color:var(--ink-3)} .es-facts dd{margin:2px 0 0;font-weight:600;font-size:15px}
        .es-facts .wide{grid-column:1/-1}
        @keyframes es-fade{from{opacity:0}} @keyframes es-rise{from{opacity:0;transform:translateY(16px)}}
        @media (max-width:899px){
          .es-stage{display:block;height:auto}
          .es-globe{position:sticky;top:40px;height:38dvh;z-index:2;background:radial-gradient(120% 120% at 50% 40%,#FFFFFF 0%,#F1F1EC 70%,#E8E9E5 100%);
            box-shadow:0 10px 24px -18px rgba(11,37,69,.45)}
          .es-panel{overflow:visible;padding:22px 16px 40px}
          .es-title{font-size:34px}
          .es-card.on{transform:none}
          .es-scrim{align-items:flex-end;padding:0}
          .es-dialog{width:100%;border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));max-height:88dvh}
        }
        @media (prefers-reduced-motion:reduce){.es-scrim,.es-dialog{animation:none}.es-card,.es-chev,.es-poster{transition:none}}
      `}</style>

      <svg className="es-lead" aria-hidden="true">
        <path ref={lead} fill="none" stroke="#00AEEF" strokeWidth="1.5" strokeDasharray="3 4" style={{ opacity: 0 }} />
        <circle ref={leadDot} r="9" fill="none" stroke="#00AEEF" strokeWidth="1.5" style={{ opacity: 0 }} />
      </svg>

      <div className="es-stage">
        <div className="es-globe">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="es-poster" src="/globe-poster.jpg" alt="" aria-hidden="true" style={{ opacity: ready ? 0 : 1 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <SiteGlobe handle={globe} mode={tab} view={view} hot={hot} reducedMotion={reducedMotion} still={phone}
            onReady={() => setReady(true)} onPick={pickFromGlobe} />
        </div>

        <div className="es-panel">
          <div className="ops-eyebrow">SAP &amp; AI · Workforce readiness</div>
          <h1 className="es-title">Enterprise Scheduler</h1>
          <p style={{ fontSize: 16.5, color: "var(--ink-2)", margin: "10px 0 20px", maxWidth: 560, lineHeight: 1.5 }}>
            Choose a site of a New Zealand dairy manufacturer-exporter. A CP-SAT solver schedules its people&apos;s training around their shifts.
          </p>
          <div className="ops-seg" role="group" aria-label="Kind of site" style={{ display: "inline-flex" }}>
            <button aria-pressed={tab === "manufacturing"} onClick={() => switchTab("manufacturing")}>Manufacturing</button>
            <button aria-pressed={tab === "office"} onClick={() => switchTab("office")}>In-market offices</button>
          </div>

          <div className="es-regions" onKeyDown={onListKey} onMouseLeave={() => { hoverTo(null, 260); setHot(null); }}>
            {regions.map((r) => {
              const isOpen = r.id === openId;
              const on = hover?.id === r.id || (isOpen && !hover && !tour);
              return (
                <section key={r.id} className={`es-card${on ? " on" : ""}${tour?.id === r.id ? " tour" : ""}`} data-open={isOpen}
                  aria-label={r.name} onMouseEnter={() => hoverTo(r)}>
                  <button className="es-head" data-lead={r.id} aria-expanded={isOpen} aria-controls={`sites-${r.id}`}
                    onFocus={() => hoverTo(r, 0)}
                    onClick={() => { setOpenId(isOpen ? null : r.id); setTour(null); if (phone) setHover(null); }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="es-name">{r.name}</span>
                      <span className="es-stat" style={{ display: "block" }}>
                        {r.sites.length} {r.sites.length === 1 ? (tab === "office" ? "office" : "site") : (tab === "office" ? "offices" : "sites")}
                        {" · "}~{r.people.toLocaleString("en-NZ")} people · up to {r.courses} courses
                      </span>
                      <span className="es-bar" aria-hidden="true" style={{ display: "block" }}><i style={{ width: `${Math.max(6, (r.people / maxPeople) * 100)}%` }} /></span>
                    </span>
                    <svg className="es-chev" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {isOpen && (
                    <div className="es-sites" id={`sites-${r.id}`}>
                      {r.sites.map((s) => (
                        <button key={s.id} data-site={s.id} data-lead={`site:${s.id}`} aria-haspopup="dialog"
                          className={`es-row${s.kind === "research" ? " rnd" : ""}${hot === s.id ? " hot" : ""}`}
                          onMouseEnter={() => setHot(s.id)} onMouseLeave={() => setHot(null)}
                          onFocus={() => setHot(s.id)} onBlur={() => setHot(null)}
                          onClick={(e) => openSite(s, e.currentTarget)}>
                          <span className="ic"><SiteIcon site={s} size={30} /></span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 600, fontSize: 15.5 }}>
                              {s.name}{s.scale === "large" && <span className="es-tag">Major</span>}
                            </span>
                            <span style={{ display: "block", fontSize: 13, color: "var(--ink-3)" }}>
                              {s.kind === "research" ? "Research and development · " : ""}{s.place} · ~{presetFor(s).employees} people
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 24, lineHeight: 1.5 }}>
            Places are public. The people, roles and courses behind each one are illustrative, generated from an inferred profile.
          </p>
        </div>
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
