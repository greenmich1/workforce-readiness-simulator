/* ops-family/ops-suite.js — the slim header shared by the SAP & AI projects.
   Canonical copy: greenwell/shared/ops-family/ (synced into each repo; edit there).

   <script type="module" src="./ops-suite.js"></script>
   <ops-suite current="dairy-twin"></ops-suite>
   <ops-suite current="maritime" theme="night"></ops-suite>
   <ops-suite current="scheduler" room="situation"></ops-suite>   (the room this project hangs off)
   <ops-suite current="seal-sentinel" theme="night"></ops-suite>
   <ops-suite current="collect"></ops-suite>
   <ops-suite current="plan"></ops-suite>

   A hand-off from another app (family.js, `#handoff=…` in the link) shows as a chip in the strip, "From Plan · …",
   with a card under it: what was handed over, the trail so far, and what this app did with it (`applied()`).

   A framework-free custom element, so it works the same in plain JS, React and Next.js. Its styles
   live in its shadow root (a host page's CSS cannot reach in); it reads the family's colour and font
   tokens from the page when they are set, and falls back to the light values. 40 px tall, keyboard
   reachable, labelled. */

import { APPS, appOf, readHandoff } from './family.js';

/** Greenwell's rooms. "Back" goes to the room the project hangs off (SAP Autonomous Enterprise for these
 *  four; owner, 2026-10-09). The key stays `situation`, so existing pages need no change. */
const ROOMS = {
  situation: { name: 'SAP Autonomous Enterprise', url: 'https://greenwell.vercel.app/autonomous-enterprise' },
};
const PORTFOLIO = 'https://my-new-webapp-kappa.vercel.app/';

const css = `
:host { display: block; position: relative; z-index: 1000; height: 40px; font-family: var(--sans, 'Figtree', system-ui, sans-serif); }
nav { height: 40px; display: flex; align-items: center; gap: 4px; padding: 0 12px 0 14px; box-sizing: border-box;
  background: var(--glass, rgba(255,255,255,.8)); -webkit-backdrop-filter: blur(18px) saturate(1.3); backdrop-filter: blur(18px) saturate(1.3);
  border-bottom: 1px solid var(--line, rgba(11,37,69,.11)); color: var(--ink, #0B2545); }
.suite { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3, #66758C); margin-right: 8px; white-space: nowrap; }
ul { display: flex; gap: 2px; list-style: none; margin: 0; padding: 0; min-width: 0; overflow-x: auto; scrollbar-width: none; }
ul::-webkit-scrollbar { display: none; }
a { color: inherit; text-decoration: none; border-radius: 8px; }
a:focus-visible { outline: 2px solid var(--sky, #00AEEF); outline-offset: 1px; }
.app { display: flex; align-items: center; height: 28px; padding: 0 10px; font-size: 13px; font-weight: 600; color: var(--ink-2, #43556F); white-space: nowrap; }
.app:hover { background: var(--well, rgba(255,255,255,.55)); color: var(--ink, #0B2545); }
.app[aria-current="page"] { background: var(--paper, #fff); color: var(--ink, #0B2545); box-shadow: 0 1px 3px rgba(11,37,69,.12); }
.app[aria-current="page"]::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--blue, #00539B); margin-right: 7px; }
.back { margin-left: auto; font-size: 12.5px; font-weight: 600; color: var(--ink-3, #66758C); padding: 4px 8px; white-space: nowrap; }
.back:hover { color: var(--ink, #0B2545); }
.ho { display: inline-flex; align-items: center; gap: 6px; height: 26px; margin-left: 8px; padding: 0 10px; border-radius: 999px; border: 1px solid #CFC5F7;
  background: var(--uv-soft, #EEEAFD); color: var(--uv-ink, #4A2FC2); font: 600 12px var(--sans, 'Figtree', system-ui, sans-serif); white-space: nowrap; cursor: pointer; max-width: 340px; min-width: 0; flex: 0 1 auto; }
.ho span { overflow: hidden; text-overflow: ellipsis; }
.ho:focus-visible { outline: 2px solid var(--sky, #00AEEF); outline-offset: 1px; }
.card { position: absolute; top: 46px; left: 50%; transform: translateX(-50%); width: min(400px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px 16px 12px;
  background: var(--paper, #fff); color: var(--ink, #0B2545); border: 1px solid var(--line, rgba(11,37,69,.11)); border-radius: 14px;
  box-shadow: 0 2px 4px rgba(11,37,69,.08), 0 14px 40px rgba(11,37,69,.16); display: flex; flex-direction: column; gap: 7px; font-size: 13px; line-height: 1.45; }
.card[hidden] { display: none; }
.card .eb { font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--uv-ink, #4A2FC2); }
.card h3 { margin: 0; font: 600 17px/1.25 var(--display, 'Newsreader', Georgia, serif); }
.card p { margin: 0; color: var(--ink-2, #43556F); }
.card .trail { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 11.5px; color: var(--ink-3, #66758C); }
.card .trail b { font-weight: 600; color: var(--ink-2, #43556F); }
.card .done { font-size: 12.5px; color: var(--ok, #2E7D46); font-weight: 600; }
.card .done.no { color: var(--ink-3, #66758C); font-weight: 500; }
.card .x { position: absolute; right: 8px; top: 6px; width: 30px; height: 30px; border: 0; background: transparent; border-radius: 8px; font-size: 18px; color: var(--ink-3, #66758C); cursor: pointer; }
.card .x:hover { background: var(--well, rgba(11,37,69,.05)); }
@media (max-width: 640px) { .suite { display: none; } .app { padding: 0 8px; font-size: 12.5px; } .back span { display: none; } .ho { flex: 0 0 auto; max-width: none; padding: 0 8px; margin-left: 4px; } .ho .t { display: none; } }
`;

class OpsSuite extends HTMLElement {
  static get observedAttributes() { return ['current', 'room', 'portfolio', 'theme']; }

  connectedCallback() {
    this.render();
    this._applied = this._applied || null;
    if (!this._onApplied) { this._onApplied = (e) => { this._applied = e.detail?.text || ''; this.paintHandoff(); }; window.addEventListener('family-handoff-applied', this._onApplied); }
    const h = this.handoff();
    if (h && !this._shown) { this._shown = true; this.openCard(true); }
  }
  disconnectedCallback() { if (this._onApplied) { window.removeEventListener('family-handoff-applied', this._onApplied); this._onApplied = null; } }
  /** The hand-off this page arrived with, if it was meant for this app. */
  handoff() { const h = readHandoff(); return h && h.to === this.getAttribute('current') ? h : null; }
  openCard(auto) {
    const c = this.shadowRoot?.querySelector('.card'), b = this.shadowRoot?.querySelector('.ho'); if (!c) return;
    this._open = true; c.hidden = false; b?.setAttribute('aria-expanded', 'true');
    clearTimeout(this._t); if (auto) this._t = setTimeout(() => { if (!c.matches(':hover') && !c.contains(this.shadowRoot.activeElement)) this.closeCard(); }, 9000);
  }
  closeCard() { this._open = false; const c = this.shadowRoot?.querySelector('.card'); if (c) c.hidden = true; this.shadowRoot?.querySelector('.ho')?.setAttribute('aria-expanded', 'false'); }
  paintHandoff() {
    const d = this.shadowRoot?.querySelector('.card .done'); if (!d) return;
    d.className = 'done' + (this._applied ? '' : ' no');
    d.textContent = this._applied ? `✓ ${this._applied}` : 'Shown here for context; this view does not act on it.';
  }
  attributeChangedCallback() { if (this.shadowRoot) this.render(); }

  render() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const current = this.getAttribute('current');
    const room = ROOMS[this.getAttribute('room') || 'situation'] ?? ROOMS.situation;
    // `portfolio` overrides the room link (kept for pages written before the rooms existed).
    const back = this.getAttribute('portfolio') ? { name: 'Portfolio', url: this.getAttribute('portfolio') } : room;
    if (this.getAttribute('theme')) this.dataset.theme = this.getAttribute('theme');
    const ho = this.handoff(), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    root.innerHTML = `
      <style>${css}</style>
      <nav aria-label="SAP and AI projects">
        <span class="suite" aria-hidden="true">SAP &amp; AI</span>
        <ul>
          ${APPS.filter((a) => a.live !== false || a.id === current).map((a) => `<li><a class="app" href="${a.url}" title="${a.what}" ${a.id === current ? 'aria-current="page"' : ''}>${a.name}</a></li>`).join('')}
        </ul>
        ${ho ? `<button class="ho" aria-expanded="${this._open ? 'true' : 'false'}" aria-controls="hocard" title="Handed over from ${esc(appOf(ho.from)?.name || ho.from)}">↘ <span>From ${esc(appOf(ho.from)?.name || ho.from)}<span class="t"> · ${esc(ho.title)}</span></span></button>` : ''}
        <a class="back" href="${back.url}" aria-label="Back to the ${back.name}">← <span>${back.name}</span></a>
      </nav>
      ${ho ? `<div class="card" id="hocard" role="dialog" aria-label="Hand-off from ${esc(appOf(ho.from)?.name || ho.from)}"${this._open ? '' : ' hidden'}>
        <button class="x" aria-label="Close">×</button>
        <span class="eb">Handed over from ${esc([...new Set([appOf(ho.from)?.stage, appOf(ho.from)?.name || ho.from].filter(Boolean))].join(' · '))}</span>
        <h3>${esc(ho.title)}</h3>${ho.detail ? `<p>${esc(ho.detail)}</p>` : ''}
        <div class="trail" aria-label="The chain so far">${[...ho.trail.map((s) => s.app), ho.from, ho.to].map((id, i, a) => `<b>${esc(appOf(id)?.name || id)}</b>${i < a.length - 1 ? '<span aria-hidden="true">→</span>' : ''}`).join('')}</div>
        <span class="done no"></span>
      </div>` : ''}`;
    if (ho) {
      root.querySelector('.ho').onclick = () => (root.querySelector('.card').hidden ? this.openCard(false) : this.closeCard());
      root.querySelector('.card .x').onclick = () => this.closeCard();
      root.querySelector('.card').addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeCard(); });
      this.paintHandoff();
    }
    // on a narrow screen the tabs scroll: bring the current one into view
    requestAnimationFrame(() => {
      const cur = root.querySelector('[aria-current="page"]'), ul = root.querySelector('ul'); if (!cur || ul.scrollWidth <= ul.clientWidth) return;
      ul.scrollLeft += Math.max(0, cur.getBoundingClientRect().right - ul.getBoundingClientRect().right + 4);
    });
  }
}

if (!customElements.get('ops-suite')) customElements.define('ops-suite', OpsSuite);
export { APPS, ROOMS, PORTFOLIO };
