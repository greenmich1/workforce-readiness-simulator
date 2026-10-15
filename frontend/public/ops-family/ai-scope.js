/* ops-family/ai-scope.js — the family's one AI scope control and its one measure of success.
   Canonical copy: greenwell/shared/ops-family/ (synced into each repo; edit there). Styles: family.css (.ops-scope…).

   The control is the Dairy Twin's dial (owner, 2026-10-15): three stops, SAP AI → + MyWave → + Gap-fill, each adding to
   the one before, with "Compare tiers" under it.

   The measure is the Value index (owner, 2026-10-15: not money): 0–100, where 100 means every measure at its ideal. It
   is the plain mean of a module's three or four measures, each already a percentage of its ideal (vats collected
   before they fill, defects stopped before dispatch, warning time…), so it means something at every tier on its own.

   const ui = mountScope(el, { tier: 'sap', counts: { sap: 5, mywave: 5, gap: 4 }, onChange, onCompare });
   ui.update({ tier, counts }); ui.busy(true); ui.card(valueCard({ measures, rows, current, note }));
   Plain DOM and strings, so React pages use it through a ref. */

export const TIERS = [
  { id: 'sap', label: 'SAP AI', short: 'SAP', badge: 'SAP', text: 'Only AI that SAP has published: Joule, Joule agents and embedded AI.' },
  { id: 'mywave', label: '+ MyWave', short: '+ MyWave', badge: 'MW', text: 'Adds MyWave AI catalogue agents for the jobs SAP has no agent for.' },
  { id: 'gap', label: '+ Gap-fill', short: '+ Gap-fill', badge: '✦', text: 'Adds agents neither catalogue offers: the fully autonomous art of the possible.' },
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const tierChip = (id) => `<span class="ops-tchip t-${id}">${TIERS.find((t) => t.id === id)?.badge ?? ''}</span>`;

/** The Value index of a set of measures ({ id: percent }): their plain mean, 0–100. */
export function valueIndex(m) { const v = Object.values(m).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }

/**
 * Mount the dial in `el`. Options:
 *   tier            the current tier id
 *   counts          { sap, mywave, gap }: agents of each tier in play at the current tier (for the line under the dial)
 *   onChange(id)    a stop was chosen
 *   onCompare()     shows the "Compare tiers" button; called when it is pressed
 *   legend          false hides the tier legend
 */
export function mountScope(el, o = {}) {
  let tier = o.tier || 'sap', counts = o.counts || null, busy = false, ran = false;
  el.classList.add('ops-scope-box');
  el.innerHTML = `<div class="ops-scope" role="group" aria-label="AI scope: which agents take part"><div class="ops-scope-fill"></div>${TIERS.map((t) => `<button type="button" class="t-${t.id}" data-tier="${t.id}"><i></i>${esc(t.label)}</button>`).join('')}</div>
    <p class="ops-scope-text"></p>
    ${o.legend === false ? '' : `<div class="ops-scope-legend">${TIERS.map((t) => `<span>${tierChip(t.id)}${t.id === 'sap' ? 'SAP-published AI' : t.id === 'mywave' ? 'MyWave catalogue' : 'Gap-fill'}</span>`).join('')}</div>`}
    ${o.onCompare ? '<button type="button" class="ops-scope-cmp">Compare tiers</button><div class="ops-scope-card"></div>' : ''}`;
  el.querySelectorAll('.ops-scope button').forEach((b) => { b.onclick = () => { if (b.dataset.tier !== tier) o.onChange?.(b.dataset.tier); }; });
  const cmp = el.querySelector('.ops-scope-cmp'); if (cmp) cmp.onclick = () => { if (!busy) o.onCompare(); };
  function paint() {
    const ix = TIERS.findIndex((t) => t.id === tier);
    el.querySelectorAll('.ops-scope button').forEach((b, i) => { b.setAttribute('aria-pressed', String(i === ix)); b.classList.toggle('lit', i < ix); });
    el.querySelector('.ops-scope-fill').style.width = `${(ix / 2) * 66.6}%`;
    const T = TIERS[ix], n = counts;
    el.querySelector('.ops-scope-text').textContent = `${T.text}${n ? ` ${n.sap || 0} SAP${n.mywave ? ` · ${n.mywave} MyWave` : ''}${n.gap ? ` · ${n.gap} gap-fill` : ''} agent${(n.sap || 0) + (n.mywave || 0) + (n.gap || 0) === 1 ? '' : 's'} in play.` : ''}`;
    if (cmp) { cmp.disabled = busy; cmp.textContent = busy ? 'Comparing…' : ran ? 'Compare again' : 'Compare tiers'; }
  }
  paint();
  return {
    update(u = {}) { if (u.tier) tier = u.tier; if (u.counts !== undefined) counts = u.counts; paint(); },
    busy(on) { busy = !!on; if (on) ran = true; paint(); },
    card(html) { const c = el.querySelector('.ops-scope-card'); if (c && c.innerHTML !== html) c.innerHTML = html; if (html) ran = true; paint(); },
    get tier() { return tier; },
  };
}

/**
 * The comparison card: the Value index for each tier, then each measure, with a finding in plain words.
 *   measures  [{ id, label, hint }]          what the index is made of (each 0–100 % of its ideal)
 *   rows      { sap: { id: percent }, … }    a tier missing from rows shows a spinner (still running)
 *   current   the visitor's tier (its column is marked)
 *   title     defaults to "What each AI scope adds"; note: a line under the table (what was run, how)
 *   finding   overrides the generated finding
 */
export function valueCard({ measures, rows = {}, current, title = 'What each AI scope adds', note = '', finding, pending = {} }) {
  const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
  const idx = Object.fromEntries(TIERS.map((t) => [t.id, rows[t.id] ? valueIndex(Object.fromEntries(measures.map((m) => [m.id, rows[t.id][m.id]]))) : NaN]));
  const cell = (t, v, big) => {
    if (!rows[t.id]) return `<td>${pending[t.id] ? esc(pending[t.id]) : '<span class="ops-spin" aria-label="running"></span>'}</td>`;
    return `<td class="${t.id === current ? 'me' : ''}"><b>${f1(v)}</b><span class="ops-vbar${big ? ' big' : ''}"><i class="t-${t.id}" style="width:${Math.max(0, Math.min(100, v))}%"></i></span></td>`;
  };
  const head = `<colgroup><col class="m">${TIERS.map(() => '<col>').join('')}</colgroup><thead><tr><th></th>${TIERS.map((t) => `<th class="${t.id === current ? 'me' : ''}" title="${esc(t.label)}" aria-label="${esc(t.label)}">${tierChip(t.id)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody><tr class="ix"><th>Value index</th>${TIERS.map((t) => cell(t, idx[t.id], true)).join('')}</tr>`
    + measures.map((m) => `<tr><th title="${esc(m.hint || '')}">${esc(m.label)}</th>${TIERS.map((t) => cell(t, rows[t.id]?.[m.id])).join('')}</tr>`).join('') + '</tbody>';
  const fin = finding ?? findingOf(measures, rows, idx);
  return `<div class="ops-value"><div class="ops-value-h"><b>${esc(title)}</b><span>Value index · out of 100, every measure at its ideal</span></div>
    <div class="ops-value-scroll"><table>${head}${body}</table></div>${fin ? `<p class="ops-value-f">${fin}</p>` : ''}${note ? `<p class="ops-value-n">${esc(note)}</p>` : ''}</div>`;
}

/** "+ MyWave adds 4.2 points, most of it in warning time (+11.0). + Gap-fill adds 3.1 more, most in milk used (+6.2)." */
export function findingOf(measures, rows, idx) {
  if (!rows.sap || !rows.mywave || !rows.gap) return '';
  const step = (a, b, T, more) => {
    const d = idx[b] - idx[a]; if (!Number.isFinite(d)) return '';
    const by = measures.map((m) => ({ m, d: (rows[b][m.id] ?? 0) - (rows[a][m.id] ?? 0) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    const top = by[0], worse = by.filter((x) => x.d < -0.05);
    if (Math.abs(d) < 0.05) return `${T} adds nothing measurable here.`;
    let s = `${T} ${d > 0 ? 'adds' : 'costs'} <b>${Math.abs(d).toFixed(1)} point${Math.abs(d).toFixed(1) === '1.0' ? '' : 's'}</b>${more && d > 0 ? ' more' : ''}, most of it in ${esc(top.m.label.toLowerCase())} (${top.d > 0 ? '+' : '−'}${Math.abs(top.d).toFixed(1)})`;
    if (d > 0 && worse.length) s += `, though ${esc(worse[0].m.label.toLowerCase())} falls ${Math.abs(worse[0].d).toFixed(1)}`;
    return s + '.';
  };
  return `${step('sap', 'mywave', '+ MyWave', false)} ${step('mywave', 'gap', '+ Gap-fill', true)}`.trim();
}
