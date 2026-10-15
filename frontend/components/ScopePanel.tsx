"use client";
/**
 * The SAP & AI family's one AI scope control (the Dairy Twin's dial) and its Value index card, in the Scheduler's
 * inspector. The markup and styles are the family's own — public/ops-family/ai-scope.js and family.css, synced from
 * greenwell — so this only mounts them. Choosing a stop shows that scope's schedule, running the solver if it has not
 * run yet (lib/aiScope.ts says which solver each scope stands for).
 */
import { useEffect, useRef } from "react";
import { MEASURES, inPlay, type Tier } from "../lib/aiScope";

interface ScopeModule {
  mountScope: (el: HTMLElement, o: Record<string, unknown>) => { update: (u: Record<string, unknown>) => void; card: (html: string) => void; busy: (on: boolean) => void };
  valueCard: (o: Record<string, unknown>) => string;
}
// The family's file from /public, loaded at run time rather than bundled.
const SRC = "/ops-family/ai-scope.js";
const loadScope = () => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SRC) as Promise<ScopeModule>;

export default function ScopePanel({ tier, onTier, rows, pending, note }: {
  tier: Tier;
  onTier: (t: Tier) => void;
  rows: Partial<Record<Tier, Record<string, number>>>;
  /** What a scope's empty column says (e.g. "Run, about 4 min"). */
  pending: Partial<Record<Tier, string>>;
  note: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ui = useRef<ReturnType<ScopeModule["mountScope"]> | null>(null);
  const mod = useRef<ScopeModule | null>(null);
  const compared = useRef(false);
  const onTierRef = useRef(onTier); onTierRef.current = onTier;
  const paint = () => {
    if (!ui.current || !mod.current) return;
    ui.current.update({ tier, counts: inPlay(tier) });
    if (compared.current) ui.current.card(mod.current.valueCard({ measures: MEASURES, rows, current: tier, pending, note }));
  };
  const paintRef = useRef(paint); paintRef.current = paint;

  useEffect(() => {
    let live = true;
    loadScope().then((m) => {
      if (!live || !host.current) return;
      mod.current = m;
      ui.current = m.mountScope(host.current, { tier, counts: inPlay(tier), onChange: (t: Tier) => onTierRef.current(t), onCompare: () => { compared.current = true; paintRef.current(); } });
      paintRef.current();
    }).catch(() => { /* without the family file the scheduler still works */ });
    return () => { live = false; };
    // mounted once; paint() below keeps it current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { paint(); });

  return (
    <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(11,37,69,0.11)", padding: "12px 12px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 600, fontSize: 17, color: "#0B2545" }}>AI scope</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#66758C" }}>which agents</span>
      </div>
      <div ref={host} />
    </div>
  );
}
