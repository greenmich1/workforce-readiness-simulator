/**
 * The SAP & AI family's AI scope tiers for the Enterprise Scheduler (owner, 2026-10-15: every module has them), and
 * the family's measure of success, the Value index (not money: 0–100, where 100 means every measure at its ideal).
 *
 *   SAP AI      SAP publishes no agent that schedules training around shifts, so the plan is the rule-based
 *               placement (each request booked where it first fits), with Joule in SuccessFactors to ask about it
 *   + MyWave    the Work Centre Scheduling Agent (MFG-004, "operator availability") and the Time & Attendance Agent
 *               (XF-015) run the CP-SAT optimiser for 30 seconds
 *   + Gap-fill  the Readiness Planner keeps searching (the deeper solve) until the schedule is proven best or stopped
 *
 * The measures are read from the placements themselves, so the rule-based plan, the optimised one and the deeper one
 * are judged the same way.
 */
export type Tier = "sap" | "mywave" | "gap";

export const SCOPE_AGENTS = [
  { id: "JOU", tier: "sap" as Tier, name: "Joule", catalogueName: "Joule in SAP SuccessFactors", ref: "SAP Joule assistant" },
  { id: "WCS", tier: "mywave" as Tier, name: "Work Centre Scheduling", catalogueName: "Work Centre Scheduling Agent", ref: "MyWave MFG-004" },
  { id: "TNA", tier: "mywave" as Tier, name: "Time & Attendance", catalogueName: "Time & Attendance Agent", ref: "MyWave XF-015" },
  { id: "RDP", tier: "gap" as Tier, name: "Readiness Planner", catalogueName: "Readiness Planner", ref: "Gap-fill · no SAP or MyWave equivalent" },
];
const RANK: Record<Tier, number> = { sap: 0, mywave: 1, gap: 2 };
export const inPlay = (tier: Tier) => Object.fromEntries((["sap", "mywave", "gap"] as Tier[]).map((t) => [t, SCOPE_AGENTS.filter((a) => a.tier === t && RANK[a.tier] <= RANK[tier]).length]));

export const MEASURES = [
  { id: "scheduled", label: "Training scheduled", hint: "Placements booked inside the training window, none left over" },
  { id: "clash", label: "No clashes", hint: "Placements with no one double-booked and no more classes at once than there are rooms" },
  { id: "classes", label: "Classes the right size", hint: "Each class against the room: full is best; an overfull class counts as far off as a near-empty one" },
  { id: "ready", label: "Ready sooner", hint: "How early in the window each person finishes their training, on average (100 would be everyone on day one)" },
];

interface P { employee_id: string; course_id: string; day_index: number; start_slot: number; duration_slots: number; overflow: boolean; room?: number }
/** The four measures for one schedule. */
export function scopeMeasures(placements: P[], windowDays: number, maxClassroom: number, rooms: number): Record<string, number> {
  const n = placements.length;
  if (!n) return { scheduled: 100, clash: 100, classes: 100, ready: 100 };
  const live = placements.filter((p) => !p.overflow && p.day_index >= 0);
  // clashes: an employee in two places at once, or more distinct classes in a slot than rooms
  const empSlot = new Map<string, number>(), slotCourses = new Map<string, Set<string>>();
  for (const p of live) for (let s = p.start_slot; s < p.start_slot + p.duration_slots; s++) {
    const k = `${p.employee_id}|${p.day_index}|${s}`; empSlot.set(k, (empSlot.get(k) ?? 0) + 1);
    const ks = `${p.day_index}|${s}`; if (!slotCourses.has(ks)) slotCourses.set(ks, new Set()); slotCourses.get(ks)!.add(`${p.course_id}|${p.room ?? 0}`);
  }
  const clashed = live.filter((p) => { for (let s = p.start_slot; s < p.start_slot + p.duration_slots; s++) { if ((empSlot.get(`${p.employee_id}|${p.day_index}|${s}`) ?? 0) > 1) return true; if ((slotCourses.get(`${p.day_index}|${s}`)?.size ?? 0) > rooms) return true; } return false; }).length;
  // classes: one class is a course in one room starting at one time on one day; weighted by the people in it
  const cls = new Map<string, number>();
  for (const p of live) { const k = `${p.course_id}|${p.day_index}|${p.start_slot}|${p.room ?? 0}`; cls.set(k, (cls.get(k) ?? 0) + 1); }
  let fit = 0, ppl = 0; for (const size of cls.values()) { const cap = Math.max(1, maxClassroom); fit += size * (size <= cap ? size / cap : cap / size); ppl += size; }
  // ready: the day each person's last placement falls on
  const last = new Map<string, number>();
  for (const p of live) last.set(p.employee_id, Math.max(last.get(p.employee_id) ?? 0, p.day_index + 1));
  const finish = [...last.values()];
  return {
    scheduled: (100 * live.length) / n,
    clash: live.length ? 100 * (1 - clashed / live.length) : 100,
    classes: ppl ? (100 * fit) / ppl : 100,
    ready: finish.length ? 100 * (1 - finish.reduce((a, b) => a + b, 0) / finish.length / Math.max(1, windowDays)) : 100,
  };
}
