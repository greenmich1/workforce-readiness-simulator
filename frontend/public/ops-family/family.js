/* ops-family/family.js — what the SAP & AI apps share beyond their look: the apps themselves, one "today", and the
   hand-offs between stages. Canonical copy: greenwell/shared/ops-family/ (synced into each repo; edit there).

   One today (owner, 2026-10-15): every simulated app runs Wednesday 14 October 2026. Plan's twelve-week season starts
   on it; Collect, the Dairy Twin and Seal Sentinel run that day; the Scheduler plans training from it. Maritime OS
   stays on real time, because its vessels are live.

   Hand-offs: the apps live on different domains, so a hand-off travels in the link, as `#handoff=<base64url JSON>`:
     { v: 1, from, to, kind, title, detail, params, trail: [{ app, title }…] }
   `trail` holds every earlier hop, so the visitor's chain (Plan → Collect → Dairy Twin …) goes with them. The family
   header (<ops-suite>) shows an arriving hand-off; an app that understands `kind` applies it and calls `applied()`.

   import { TODAY, handoffURL, readHandoff, applied } from './ops-family/family.js'; */

/** The apps, in the pipeline's order (Plan, Collect, Make, Inspect, Ship, Trace), Enterprise Scheduler always last. */
export const APPS = [
  { id: 'plan', name: 'Plan', stage: 'Plan', url: 'https://milk-plan.vercel.app/', what: 'Milk to market' },
  { id: 'collect', name: 'Collect', stage: 'Collect', url: 'https://milk-collect-nine.vercel.app/', what: 'Milk from farm to site' },
  { id: 'dairy-twin', name: 'Dairy Twin', stage: 'Make', url: 'https://dairy-twin.vercel.app/', what: 'The plant' },
  { id: 'seal-sentinel', name: 'Seal Sentinel', stage: 'Inspect', url: 'https://seal-sentinel.vercel.app/', what: 'The line cameras' },
  { id: 'maritime', name: 'Maritime OS', stage: 'Ship', url: 'https://maritime-intel-os.vercel.app/', what: 'The order book at sea' },
  { id: 'trace', name: 'Trace', stage: 'Trace', url: 'https://milk-trace-nine.vercel.app/', what: 'Farm to market and back' },
  { id: 'scheduler', name: 'Enterprise Scheduler', stage: 'Enabler', url: 'https://workforce-readiness-simulator.vercel.app/', what: 'The people' },
];
export const appOf = (id) => APPS.find((a) => a.id === id);

/** The family's one today. */
export const TODAY = { iso: '2026-10-14', y: 2026, m: 10, d: 14, label: 'Wed 14 Oct', long: 'Wednesday 14 October 2026' };
/** A date `days` after today, as "Thu 15 Oct" (or with the year). */
export function dayLabel(days = 0, year = false) {
  const t = new Date(Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d) + Math.floor(days) * 864e5);
  return t.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace(/,/g, '');
}

const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

let received; // the hand-off this page arrived with (read once)
/** The hand-off in this page's link, or null. */
export function readHandoff() {
  if (received !== undefined) return received;
  received = null;
  try { const m = /[#&]handoff=([\w-]+)/.exec(location.hash); if (m) { const h = dec(m[1]); if (h && h.v === 1) received = h; } } catch { /* a mangled link is ignored */ }
  return received;
}
/**
 * The link that hands an event to another app: `handoffURL('collect', { kind: 'outage', title, detail, params })`.
 * The trail carries on from the hand-off this page arrived with. `from` is this app's id.
 */
export function handoffURL(to, ev, from) {
  const app = appOf(to); if (!app) throw new Error(`unknown app ${to}`);
  const prev = readHandoff(), trail = [...(prev?.trail || []), ...(prev ? [{ app: prev.from, title: prev.title }] : [])].slice(-6);
  const h = { v: 1, from, to, kind: ev.kind, title: ev.title, detail: ev.detail || '', params: ev.params || {}, trail };
  const base = globalThis.__familyURLs?.[to] || app.url; // tests point the apps at local servers
  return `${base}#handoff=${enc(h)}`;
}
/** Tell the family header what this app did with the hand-off it arrived with ("Te Rapa's outage injected at 06:00"). */
export function applied(text) {
  window.dispatchEvent(new CustomEvent('family-handoff-applied', { detail: { text } }));
}
