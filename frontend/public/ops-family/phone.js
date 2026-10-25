/* ops-family/phone.js — the SAP & AI family on a phone: one hero, one sheet (owner, 2026-10-25; greenwell/docs/MOBILE.md).
   Canonical copy: greenwell/shared/ops-family/ (synced into each repo; edit there). Styles: phone.css (all under html.phone).

   The computer version never changes: a page opts in by setting html.phone before it paints (the one line below, inline
   in <head>), then builds its phone UI with mountPhone() only when isPhone() is true.
     <script>if(matchMedia('(max-width: 759px), (pointer: coarse) and (max-height: 500px)').matches)document.documentElement.classList.add('phone')</script>

   const P = mountPhone({ about, computer: ['the ledger', 'the maths'], onReset });
   P.status(html)  the peek's one line          P.primary(button | null)  the peek's one action
   P.half          the half sheet's element     P.full                    the full sheet's element (above the footer)
   P.hud           the hero's overlay           P.snap('peek' | 'half' | 'full')
   Pieces: playButton(onClick), heroSwitch(el, options, value, onChange), scopeChips(el, { tier, counts, onChange }),
   valueLine(value, note). */

import { TIERS } from './ai-scope.js';

export const PHONE_QUERY = '(max-width: 759px), (pointer: coarse) and (max-height: 500px)';
/** Decided once, at load: a phone keeps its phone layout when it turns sideways. */
export const isPhone = () => document.documentElement.classList.contains('phone') || matchMedia(PHONE_QUERY).matches;
if (matchMedia(PHONE_QUERY).matches) document.documentElement.classList.add('phone');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/** Build the sheet. `computer` names what the phone leaves out; `about` is the full sheet's short note. */
export function mountPhone({ about = '', computer = [], onReset = null, resetLabel = 'Start again' } = {}) {
  const hud = document.createElement('div'); hud.className = 'ph-hud';
  const sheet = document.createElement('section'); sheet.className = 'ph-sheet'; sheet.setAttribute('aria-label', 'Details');
  sheet.innerHTML = `
    <div class="ph-grab">
      <button class="ph-handle" type="button" aria-expanded="false" aria-label="Show more"><i></i></button>
      <div class="ph-peek"><div class="ph-status" aria-live="polite"></div><div class="ph-primary"></div></div>
    </div>
    <div class="ph-body">
      <div class="ph-half"></div>
      <div class="ph-full">${about ? `<p class="ph-about">${esc(about)}</p>` : ''}</div>
      <footer class="ph-foot">
        ${computer.length ? `<p>This is the short version. On a computer: ${esc(list(computer))}.</p>` : ''}
        ${onReset ? `<div class="ph-foot-acts"><button type="button" class="ph-reset">${esc(resetLabel)}</button></div>` : ''}
      </footer>
    </div>`;
  document.body.append(hud, sheet);
  const $ = (s) => sheet.querySelector(s), handle = $('.ph-handle'), body = $('.ph-body');

  // ---- the snaps: peek (the status and one action), half, full. The safe areas are measured once (a probe). ----
  const probe = document.createElement('i'); probe.style.cssText = 'position:fixed;left:0;top:env(safe-area-inset-top,0px);width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const safe = () => { const r = probe.getBoundingClientRect(); return { top: r.top, bottom: r.height }; };
  const PEEK = 132, BAR = 40;
  const H = { peek: () => PEEK + safe().bottom, half: () => Math.round(innerHeight * 0.56), full: () => innerHeight - safe().top - BAR - 8 };
  const root = document.documentElement;
  const vars = () => root.style.setProperty('--ph-peek', `${H.peek()}px`);
  vars();
  let at = 'peek';
  function snap(name, instant = false) {
    at = name; sheet.classList.toggle('instant', instant); sheet.style.height = `${H[name]()}px`; sheet.dataset.snap = name;
    handle.setAttribute('aria-expanded', String(name !== 'peek')); handle.setAttribute('aria-label', name === 'full' ? 'Show less' : 'Show more');
    if (name === 'peek') body.scrollTop = 0;
  }
  snap('peek', true);
  addEventListener('resize', () => { vars(); snap(at, true); });
  const cycle = () => snap(at === 'peek' ? 'half' : at === 'half' ? 'full' : 'peek');
  handle.onclick = (e) => { if (e.detail === 0) cycle(); }; // the keyboard; a tap is handled with the drag below

  // drag the sheet by its top (the handle and the status line), never by its buttons
  let drag = null;
  $('.ph-grab').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ph-primary button, .ph-primary a')) return;
    drag = { y: e.clientY, h: sheet.getBoundingClientRect().height, t: performance.now(), moved: false };
  });
  $('.ph-grab').addEventListener('pointermove', (e) => {
    if (!drag) return; const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; sheet.classList.add('instant'); $('.ph-grab').setPointerCapture(e.pointerId); }
    if (!drag.moved) return;
    sheet.style.height = `${Math.max(H.peek(), Math.min(H.full(), drag.h + dy))}px`;
  });
  const end = (e) => {
    if (!drag) return; const d = drag; drag = null; sheet.classList.remove('instant');
    if (!d.moved) { if (e.type === 'pointerup') { if (e.target.closest('.ph-handle')) cycle(); else if (at === 'peek') snap('half'); } return; }
    const h = sheet.getBoundingClientRect().height, v = (d.y - e.clientY) / Math.max(1, performance.now() - d.t); // px/ms, up is +
    const names = ['peek', 'half', 'full'];
    let best = names.reduce((a, n) => (Math.abs(H[n]() - h) < Math.abs(H[a]() - h) ? n : a), 'peek');
    if (Math.abs(v) > 0.5) { const i = names.indexOf(at); best = names[Math.max(0, Math.min(2, i + (v > 0 ? 1 : -1)))]; }
    snap(best);
  };
  $('.ph-grab').addEventListener('pointerup', end); $('.ph-grab').addEventListener('pointercancel', end);

  if (onReset) $('.ph-reset').onclick = () => { onReset(); snap('peek'); };

  return {
    hud, sheet, half: $('.ph-half'), full: $('.ph-full'), snap, get at() { return at; },
    status(html) { const s = $('.ph-status'); if (s.innerHTML !== html) s.innerHTML = html; },
    primary(node) { const p = $('.ph-primary'); if (node ? p.firstChild !== node : p.firstChild) { p.replaceChildren(...(node ? [node] : [])); } sheet.classList.toggle('has-primary', !!node); },
  };
}

/** The one round play/pause on the hero. */
export function playButton(onClick) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ph-play'; b.onclick = onClick;
  const set = (on, label) => { b.setAttribute('aria-label', label || (on ? 'Pause' : 'Play')); b.innerHTML = on ? '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>' : '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5v11l9.5-5.5z" fill="#fff"/></svg>'; };
  set(false); return { el: b, set };
}

/** A two-way switch between a module's two heroes. options: [{ id, label }]. */
export function heroSwitch(el, options, value, onChange) {
  const w = document.createElement('div'); w.className = 'ph-switch'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', 'View');
  w.innerHTML = options.map((o) => `<button type="button" data-v="${esc(o.id)}">${esc(o.label)}</button>`).join('');
  const set = (v) => w.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  w.onclick = (e) => { const b = e.target.closest('button'); if (b && b.getAttribute('aria-pressed') !== 'true') { set(b.dataset.v); onChange(b.dataset.v); } };
  set(value); el.append(w); return { el: w, set };
}

/** The AI scope as three chips (the computer keeps the dial). counts: agents in play, as for mountScope. */
export function scopeChips(el, { tier = 'sap', counts = null, onChange }) {
  el.classList.add('ph-scope');
  el.innerHTML = `<div class="ph-chips" role="group" aria-label="AI scope: which agents take part">${TIERS.map((t) => `<button type="button" class="t-${t.id}" data-tier="${t.id}">${esc(t.label)}</button>`).join('')}</div><p class="ph-scope-t"></p>`;
  el.querySelector('.ph-chips').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.tier !== tier) onChange?.(b.dataset.tier); };
  function update(u = {}) {
    if (u.tier) tier = u.tier; if (u.counts !== undefined) counts = u.counts;
    el.querySelectorAll('.ph-chips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === tier)));
    const n = counts ? (counts.sap || 0) + (counts.mywave || 0) + (counts.gap || 0) : null;
    el.querySelector('.ph-scope-t').textContent = `${TIERS.find((t) => t.id === tier).text}${n != null ? ` ${n} agent${n === 1 ? '' : 's'} in play.` : ''}`;
  }
  update(); return { update, get tier() { return tier; } };
}

/** The Value index as one big number. */
export function valueLine(el) {
  el.classList.add('ph-value');
  el.innerHTML = '<b class="num"></b><span><strong>Value index</strong><small>100 means every measure at its ideal</small></span>';
  return { set(v) { const t = Number.isFinite(v) ? v.toFixed(1) : '—'; const b = el.querySelector('b'); if (b.textContent !== t) b.textContent = t; } };
}
