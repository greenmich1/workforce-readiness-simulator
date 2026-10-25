"use client";
/**
 * The Enterprise Scheduler on a phone (owner, 2026-10-25; greenwell/docs/MOBILE.md).
 *
 * The site picker (`/`) already works on a phone: the map of sites, then a site card. Here, at a site, the hero is an
 * agenda of the days — each day's classes as rows (time, course, people), the phone's reading of the week grid — and
 * one sheet from the family kit (`public/ops-family/phone.js`): the site and Optimise at peek, then the Value index,
 * readiness and what could not fit, and the AI scope as three chips. The week grid, zoom, the site profile, the shift
 * patterns, New workforce, the inspectors and Compare tiers stay on the computer. Mounted by `app/app/page.tsx` only
 * under `html.phone`; the computer and tablet layouts never see it.
 */
import { useEffect, useMemo, useRef } from "react";
import type { Tier } from "../lib/aiScope";

interface Placement { employee_id: string; course_id: string; day_index: number; start_slot: number; duration_slots: number; overflow: boolean; room?: number }
interface TimeModel { day_start_hour: number; slot_minutes: number; training_window_days: number; start_date?: string }
interface Snap { nodes: { id: string; label: string }[]; placements: Placement[]; time_model: TimeModel; phase: "planned" | "optimized" }

type Kit = {
  mountPhone: (o: { about?: string; computer?: string[] }) => {
    hud: HTMLElement; sheet: HTMLElement; half: HTMLElement; full: HTMLElement
    snap: (s: "peek" | "half" | "full") => void; status: (html: string) => void; primary: (n: HTMLElement | null) => void
  };
  scopeChips: (el: HTMLElement, o: { tier: Tier; counts: null; onChange: (t: Tier) => void }) => { update: (u: { tier?: Tier }) => void };
  valueLine: (el: HTMLElement) => { set: (v: number | null) => void };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const dayLabel = (base: string, d: number) => { const t = new Date(base); t.setDate(t.getDate() + d); return t.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" }); };

export function PhoneScheduler({ site, statusLabel, busy, snap, value, readiness, overflow, tier, onTier, onOptimise }: {
  site: string; statusLabel: string; busy: boolean; snap: Snap | null
  value: number | null; readiness: number; overflow: number
  tier: Tier; onTier: (t: Tier) => void; onOptimise: () => void
}) {
  const ui = useRef<ReturnType<Kit["mountPhone"]> | null>(null);
  const parts = useRef<{ value: ReturnType<Kit["valueLine"]>; scope: ReturnType<Kit["scopeChips"]>; btn: HTMLButtonElement } | null>(null);
  const cb = useRef({ onTier, onOptimise }); cb.current = { onTier, onOptimise };

  // the agenda: each day's classes, a class being one course starting at one time in one room
  const days = useMemo(() => {
    if (!snap) return [];
    const tm = snap.time_model, base = tm.start_date ?? new Date().toISOString().slice(0, 10);
    const name = Object.fromEntries(snap.nodes.map((n) => [n.id, n.label]));
    const by = new Map<number, Map<string, { start: number; end: number; course: string; room: number; people: number }>>();
    for (const p of snap.placements) {
      if (p.overflow || p.day_index < 0) continue;
      const k = `${p.course_id}|${p.start_slot}|${p.room ?? 0}`;
      const day = by.get(p.day_index) ?? by.set(p.day_index, new Map()).get(p.day_index)!;
      const c = day.get(k);
      if (c) c.people++;
      else day.set(k, { start: tm.day_start_hour + (p.start_slot * tm.slot_minutes) / 60, end: tm.day_start_hour + ((p.start_slot + p.duration_slots) * tm.slot_minutes) / 60, course: name[p.course_id] ?? p.course_id, room: (p.room ?? 0) + 1, people: 1 });
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([d, m]) => ({ d, label: dayLabel(base, d), classes: [...m.values()].sort((a, b) => a.start - b.start || a.room - b.room) }));
  }, [snap]);

  useEffect(() => {
    let gone = false;
    const url = "/ops-family/" + "phone.js";   // a runtime URL, so the bundler leaves the kit in public/ alone
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url).then((kit: Kit) => {
      if (gone) return;
      const u = (ui.current = kit.mountPhone({
        about: "Training scheduled around shifts for one site of a New Zealand dairy manufacturer-exporter. The places are public; the people, roles and courses are illustrative, generated from an inferred profile. The plan starts rule-based; Optimise runs Google's CP-SAT solver for 30 seconds, and the AI scope says which agents take part.",
        computer: ["the week grid and its zoom", "who is in each class", "the site profile and the shift patterns", "a new workforce", "the deeper solve's controls", "Compare tiers"],
      }));
      u.half.innerHTML = '<div class="sp-value"></div><div class="sp-two"><div><b class="num sp-ready"></b><span>ready</span><small>of the training placed in the window</small></div><div><b class="num sp-over"></b><span>could not fit</span><small>placements left over</small></div></div><div><p class="ph-h">AI scope</p><div class="sp-scope"></div></div><p class="ph-scope-t"><a href="/">Choose another site</a></p>';
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "Optimise";
      btn.onclick = () => { cb.current.onOptimise(); u.snap("peek"); };
      parts.current = { value: kit.valueLine(u.half.querySelector(".sp-value") as HTMLElement), scope: kit.scopeChips(u.half.querySelector(".sp-scope") as HTMLElement, { tier, counts: null, onChange: (t) => cb.current.onTier(t) }), btn };
      paint();
    });
    return () => { gone = true; ui.current?.sheet.remove(); ui.current?.hud.remove(); ui.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paint() {
    const u = ui.current, p = parts.current; if (!u || !p) return;
    u.status(`<span class="ph-k${busy ? " uv" : ""}">${esc(statusLabel)}</span><b>${esc(site)}</b>`);
    p.btn.disabled = busy;
    u.primary(snap && snap.phase === "planned" ? p.btn : null);
    p.value.set(value);
    (u.half.querySelector(".sp-ready") as HTMLElement).textContent = snap?.phase === "optimized" ? `${readiness} %` : "—";
    (u.half.querySelector(".sp-over") as HTMLElement).textContent = snap?.phase === "optimized" ? String(overflow) : "—";
    p.scope.update({ tier });
  }
  useEffect(paint);

  return (
    <section className="sp-agenda" aria-label="The training, day by day">
      {!days.length && <p className="sp-empty">{busy ? "Building the workforce and its training…" : "No training placed yet."}</p>}
      {days.map((day) => (
        <div key={day.d} className="sp-day">
          <h3>{day.label}<span>{day.classes.length} class{day.classes.length === 1 ? "" : "es"}</span></h3>
          <ol>{day.classes.map((c, i) => (
            <li key={i}><span className="t">{hm(c.start)}–{hm(c.end)}</span><span className="c">{c.course}</span><span className="n">{c.people}</span></li>
          ))}</ol>
        </div>
      ))}
    </section>
  );
}
