/* ops-family/ops-suite.js — the slim header shared by the SAP & AI projects.
   Canonical copy: greenwell/shared/ops-family/ (synced into each repo; edit there).

   <script type="module" src="./ops-suite.js"></script>
   <ops-suite current="dairy-twin"></ops-suite>
   <ops-suite current="maritime" theme="night"></ops-suite>
   <ops-suite current="scheduler" room="situation"></ops-suite>   (the room this project hangs off)
   <ops-suite current="seal-sentinel" theme="night"></ops-suite>

   A framework-free custom element, so it works the same in plain JS, React and Next.js. Its styles
   live in its shadow root (a host page's CSS cannot reach in); it reads the family's colour and font
   tokens from the page when they are set, and falls back to the light values. 40 px tall, keyboard
   reachable, labelled. */

/** The tabs, in order: Enterprise Scheduler always last (owner, 2026-10-09). */
const APPS = [
  { id: 'dairy-twin', name: 'Dairy Twin', url: 'https://dairy-twin.vercel.app/', what: 'The plant' },
  { id: 'maritime', name: 'Maritime OS', url: 'https://maritime-intel-os.vercel.app/', what: 'The order book at sea' },
  { id: 'seal-sentinel', name: 'Seal Sentinel', url: 'https://seal-sentinel.vercel.app/', what: 'The line cameras' },
  { id: 'scheduler', name: 'Enterprise Scheduler', url: 'https://workforce-readiness-simulator.vercel.app/', what: 'The people' },
];
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
@media (max-width: 640px) { .suite { display: none; } .app { padding: 0 8px; font-size: 12.5px; } .back span { display: none; } }
`;

class OpsSuite extends HTMLElement {
  static get observedAttributes() { return ['current', 'room', 'portfolio', 'theme']; }

  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.shadowRoot) this.render(); }

  render() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const current = this.getAttribute('current');
    const room = ROOMS[this.getAttribute('room') || 'situation'] ?? ROOMS.situation;
    // `portfolio` overrides the room link (kept for pages written before the rooms existed).
    const back = this.getAttribute('portfolio') ? { name: 'Portfolio', url: this.getAttribute('portfolio') } : room;
    if (this.getAttribute('theme')) this.dataset.theme = this.getAttribute('theme');
    root.innerHTML = `
      <style>${css}</style>
      <nav aria-label="SAP and AI projects">
        <span class="suite" aria-hidden="true">SAP &amp; AI</span>
        <ul>
          ${APPS.filter((a) => a.live !== false || a.id === current).map((a) => `<li><a class="app" href="${a.url}" title="${a.what}" ${a.id === current ? 'aria-current="page"' : ''}>${a.name}</a></li>`).join('')}
        </ul>
        <a class="back" href="${back.url}" aria-label="Back to the ${back.name}">← <span>${back.name}</span></a>
      </nav>`;
    // on a narrow screen the tabs scroll: bring the current one into view
    requestAnimationFrame(() => {
      const cur = root.querySelector('[aria-current="page"]'), ul = root.querySelector('ul'); if (!cur || ul.scrollWidth <= ul.clientWidth) return;
      ul.scrollLeft += Math.max(0, cur.getBoundingClientRect().right - ul.getBoundingClientRect().right + 4);
    });
  }
}

if (!customElements.get('ops-suite')) customElements.define('ops-suite', OpsSuite);
export { APPS, ROOMS, PORTFOLIO };
