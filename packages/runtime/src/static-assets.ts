export const baseCss = `
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--ad-surface);color:var(--ad-ink);font-family:var(--ad-font-sans);font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
[hidden]{display:none!important}
button{font:inherit}
body[data-color-mode=dark]{--ad-paper:#171a18;--ad-ink:#eff4ef;--ad-muted:#b7c2bb;--ad-surface:#101210}
body[data-color-mode=dark] .ad-toolbar-group{border-color:rgba(255,255,255,.14);box-shadow:0 10px 24px rgba(0,0,0,.25)}
.agentdeck-app{position:relative;width:100vw;height:100vh;background:var(--ad-surface)}
.ad-dock-zone{position:absolute;left:0;right:0;bottom:0;z-index:69;height:92px;pointer-events:none}
body.is-dock-autohide .ad-dock-zone,body.is-fullscreen-toolbar-hidden .ad-dock-zone{pointer-events:auto}
.ad-dock{position:absolute;z-index:70;left:50%;bottom:18px;display:flex;align-items:center;justify-content:center;gap:10px;max-width:calc(100vw - 28px);opacity:.9;filter:blur(0);transform:translate3d(-50%,0,0) scale(1);transform-origin:50% 100%;transition:opacity .42s cubic-bezier(.22,1,.36,1),transform .42s cubic-bezier(.22,1,.36,1),filter .42s cubic-bezier(.22,1,.36,1);will-change:opacity,transform,filter}
body.is-dock-active .ad-dock,.ad-dock:hover,.ad-dock:focus-within{opacity:1;filter:blur(0);transform:translate3d(-50%,-4px,0) scale(1)}
body.is-dock-hidden .ad-dock{opacity:0;filter:blur(6px);pointer-events:none;transform:translate3d(-50%,36px,0) scale(.985)}
.ad-toolbar-group{display:flex;align-items:center;gap:8px;height:42px;padding:4px;color:var(--ad-muted);border:1px solid rgba(0,0,0,.12);border-radius:8px;background:color-mix(in srgb,var(--ad-paper) 90%,transparent);box-shadow:0 10px 24px rgba(20,24,21,.08);backdrop-filter:blur(16px)}
.ad-toolbar-group--nav{padding:4px 8px}
.ad-dock button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;min-width:32px;padding:0 11px;border:0;border-radius:6px;outline:0;background:transparent;color:var(--ad-muted);font-size:13px;font-weight:760;line-height:1;cursor:pointer}
.ad-dock button:hover,.ad-dock button:focus-visible,.ad-dock button.is-active{color:var(--ad-ink);background:var(--ad-surface)}
.ad-dock button:disabled{cursor:not-allowed;opacity:.36}
.ad-icon-only{padding:0 10px!important}
.ad-interval-button{min-width:46px!important;padding:0 10px!important}
.ad-toolbar-icon{display:inline-flex;margin-left:4px;color:var(--ad-muted)}
.ad-icon{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.ad-segmented{display:flex;gap:2px}
.ad-counter{width:54px;text-align:center;color:var(--ad-muted);font-size:13px;font-weight:760}
.ad-progress{position:absolute;left:0;right:0;bottom:0;z-index:18;height:3px;background:transparent}
.ad-progress span{display:block;width:0;height:100%;background:var(--ad-accent);transition:width .18s ease}
.ad-stage{position:absolute;inset:28px 36px 76px;display:flex;align-items:center;justify-content:center}
.ad-scaled-shell{position:relative;flex:0 0 auto}
.ad-scaled{position:absolute;top:0;left:0;width:1920px;height:1080px;transform-origin:top left}
.ad-slide{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--ad-surface) 72%,transparent),transparent 42%),var(--ad-paper);color:var(--ad-ink);box-shadow:0 28px 70px rgba(25,32,28,.12)}
.ad-content{position:relative;z-index:2;display:grid;grid-template-rows:auto 1fr;gap:54px;width:100%;height:100%;padding:122px 128px 100px}
.ad-slide-head{max-width:1240px}
.ad-kicker{margin:0 0 18px;color:var(--ad-accent);font-family:var(--ad-font-mono);font-size:18px;font-weight:800;text-transform:uppercase}
.ad-slide h1{margin:0;font-size:74px;line-height:1.04;letter-spacing:0;font-weight:760;word-break:keep-all;overflow-wrap:normal}
[data-theme=swiss] .ad-slide h1{font-weight:260;letter-spacing:0;text-transform:none}
.ad-lead{max-width:980px;margin:26px 0 0;color:var(--ad-muted);font-size:30px;line-height:1.42}
.ad-blocks{display:grid;align-content:center;gap:28px;min-height:0}
.ad-paragraph{max-width:1180px;margin:0;color:var(--ad-ink);font-size:34px;line-height:1.45}
.ad-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 28px;margin:0;padding:0;list-style:none}
.ad-list li{min-height:104px;padding:28px 30px;border:1px solid rgba(0,0,0,.12);background:var(--ad-surface);font-size:27px;line-height:1.35}
.ad-quote{max-width:1220px;margin:0;padding:52px 64px;border-left:10px solid var(--ad-accent);background:var(--ad-surface);font-family:var(--ad-font-serif);font-size:48px;line-height:1.32}
.ad-quote cite{display:block;margin-top:30px;color:var(--ad-muted);font-family:var(--ad-font-sans);font-size:22px;font-style:normal}
.ad-image{position:relative;margin:0;overflow:hidden;background:var(--ad-surface);border:1px solid rgba(0,0,0,.1)}
.ad-image img{display:block;width:100%;height:540px;object-fit:cover}
.ad-image figcaption{position:absolute;left:24px;bottom:20px;padding:8px 12px;background:rgba(0,0,0,.62);color:#fff;font-size:18px}
.ad-table{width:100%;border-collapse:collapse;background:var(--ad-paper);font-size:24px}
.ad-table th,.ad-table td{padding:22px 24px;border:1px solid rgba(0,0,0,.14);text-align:left}
.ad-table th{background:var(--ad-surface);font-weight:800}
.ad-code{margin:0;overflow:hidden;background:#101512;color:#e8f4ed;font-family:var(--ad-font-mono)}
.ad-code figcaption{padding:14px 24px;border-bottom:1px solid rgba(255,255,255,.12);color:#9de08f;text-transform:uppercase}
.ad-code pre{margin:0;padding:28px;font-size:25px;line-height:1.52;white-space:pre-wrap}
.ad-kpi{display:grid;gap:10px;width:max-content;min-width:420px;padding:36px 42px;background:var(--ad-accent);color:#fff}
.ad-kpi span{font-size:20px;font-family:var(--ad-font-mono);text-transform:uppercase}
.ad-kpi strong{font-size:92px;line-height:.9}
.ad-kpi p{margin:0;font-size:24px}
.ad-diagram,.ad-formula{margin:0;padding:42px;background:var(--ad-surface);border:1px solid rgba(0,0,0,.12);font-size:30px}
.ad-diagram pre{margin:0;white-space:pre-wrap}
.ad-formula{font-family:var(--ad-font-serif);font-size:60px;text-align:center}
.layout-cover .ad-content{display:flex;flex-direction:column;justify-content:center;gap:46px}
.layout-cover .ad-slide-head{max-width:1280px}
.layout-cover .ad-blocks{align-content:start;max-width:1120px}
.layout-cover .ad-paragraph{font-size:30px;color:var(--ad-muted)}
.layout-closing .ad-content{display:grid;grid-template-rows:auto 1fr;gap:54px}
.layout-cover .ad-slide-head h1{font-size:92px;max-width:1380px}
.layout-statement .ad-slide-head h1{font-size:86px;max-width:1420px}
.layout-image-hero .ad-blocks,.layout-screenshot .ad-blocks{align-content:stretch}
.layout-image-hero .ad-image img,.layout-screenshot .ad-image img{height:650px}
.layout-evidence-grid .ad-blocks{grid-template-columns:repeat(3,minmax(0,1fr));align-content:center}
.layout-evidence-grid .ad-image img{height:300px}
.layout-table .ad-blocks,.layout-code .ad-blocks{align-content:stretch}
.layout-html-import{background:#fff;color:#111}
.layout-html-import .ad-content{display:block;width:100%;height:100%;padding:0}
.layout-html-import .ad-blocks{display:block;width:100%;height:100%}
.layout-html-import .ad-html-block{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}
.layout-html-import .ad-html-block>*{max-width:none}
.ad-page-indicator{position:absolute;right:128px;bottom:28px;color:var(--ad-muted);font-size:18px;font-weight:700}
.ad-brand-line{position:absolute;left:0;right:0;bottom:0;height:6px;background:var(--ad-accent)}
.ad-overview{position:absolute;inset:28px;z-index:80;display:grid;grid-template-rows:auto 1fr;gap:18px;padding:20px 20px 92px;border:1px solid rgba(0,0,0,.12);border-radius:8px;background:color-mix(in srgb,var(--ad-paper) 96%,transparent);box-shadow:0 28px 90px rgba(0,0,0,.22);backdrop-filter:blur(18px)}
.ad-overview-head{display:flex;align-items:center;justify-content:flex-start;gap:14px}
.ad-overview-title{display:grid;gap:4px}
.ad-overview-head strong{font-size:20px}
.ad-overview-title p{margin:0;color:var(--ad-muted);font-size:13px}
.ad-overview-close{position:absolute;right:14px;bottom:14px;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid rgba(0,0,0,.12);border-radius:8px;background:var(--ad-surface);color:var(--ad-ink);cursor:pointer}
.ad-overview-close:hover{color:#fff;background:var(--ad-accent);border-color:transparent}
.ad-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,280px);justify-content:space-between;gap:14px;overflow:auto}
.ad-overview-card{position:relative;display:block;width:280px;height:158px;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:var(--ad-paper);color:var(--ad-ink);text-align:left;cursor:pointer;overflow:hidden}
.ad-overview-card:hover,.ad-overview-card.is-current{border-color:var(--ad-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--ad-accent) 28%,transparent)}
.ad-overview-card:hover{transform:translateY(-2px)}
.ad-overview-viewport{position:relative;width:280px;height:158px;overflow:hidden;background:var(--ad-paper)}
.ad-overview-slide{position:absolute!important;top:0;left:0;inset:auto!important;width:1920px!important;height:1080px!important;transform:scale(.1458333333)!important;transform-origin:top left!important;box-shadow:none!important;pointer-events:none}
.ad-overview-card .ad-content{padding:122px 128px 100px}
.ad-overview-card .ad-slide h1{font-size:74px}
.ad-compare{position:absolute;right:38px;bottom:96px;z-index:62;width:min(420px,28vw);padding:0;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:color-mix(in srgb,var(--ad-paper) 96%,transparent);box-shadow:0 28px 90px rgba(0,0,0,.22);backdrop-filter:blur(18px);overflow:hidden}
.ad-compare-viewport{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--ad-paper)}
.ad-compare-slide{position:absolute!important;top:0;left:0;inset:auto!important;width:1920px!important;height:1080px!important;transform-origin:top left!important;box-shadow:none!important;pointer-events:none}
.ad-compare-empty{display:grid;place-items:center;width:100%;height:100%;color:var(--ad-muted);font-size:15px}
.ad-print-help{position:absolute;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,14,16,.38);backdrop-filter:blur(12px)}
.ad-print-help-card{display:grid;gap:14px;max-width:520px;padding:24px;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:var(--ad-paper);color:var(--ad-ink);box-shadow:0 30px 90px rgba(0,0,0,.24)}
.ad-print-help-card strong{font-size:30px}
.ad-print-help-card p,.ad-print-help-card li{margin:0;color:var(--ad-muted);font-size:16px;line-height:1.45}
.ad-print-help-card ul{display:grid;gap:8px;margin:0;padding-left:20px}
.ad-print-help-note code{font-size:13px}
.ad-print-help-actions{display:flex;justify-content:flex-end;gap:10px}
.ad-print-help-actions button{height:40px;padding:0 14px;border:1px solid rgba(0,0,0,.12);border-radius:7px;background:var(--ad-surface);color:var(--ad-ink);cursor:pointer}
.ad-print-help-actions [data-action="print-confirm"]{background:var(--ad-accent);color:#fff;border-color:transparent}
.ad-blackout{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#000;color:rgba(255,255,255,.72);cursor:pointer}
.ad-blackout strong{font-size:28px;font-weight:700}
.ad-blackout span{font-size:14px}
.ad-spotlight{position:absolute;inset:0;z-index:55;pointer-events:none;background:radial-gradient(circle 150px at var(--ad-spot-x,50%) var(--ad-spot-y,50%),transparent 0 118px,rgba(0,0,0,.66) 158px)}
.ad-presenter-panel,.ad-creator-panel{position:absolute;top:28px;right:28px;z-index:25;display:none;gap:14px;width:360px;max-height:calc(100vh - 56px);overflow:auto;padding:18px;border:1px solid rgba(0,0,0,.14);border-radius:8px;background:color-mix(in srgb,var(--ad-paper) 94%,transparent);box-shadow:0 24px 70px rgba(0,0,0,.16);backdrop-filter:blur(18px)}
.ad-presenter-panel section,.ad-creator-panel section{display:grid;gap:8px;padding:0 0 14px;border-bottom:1px solid rgba(0,0,0,.1)}
.ad-presenter-panel section:last-child,.ad-creator-panel section:last-child{border-bottom:0;padding-bottom:0}
.ad-panel-label{margin:0;color:var(--ad-accent);font-family:var(--ad-font-mono);font-size:12px;font-weight:800;text-transform:uppercase}
.ad-presenter-panel article,.ad-creator-panel p,.ad-creator-panel li{margin:0;color:var(--ad-muted);font-size:15px;line-height:1.45}
.ad-presenter-panel strong,.ad-creator-panel strong{font-size:28px}
.ad-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ad-stat-grid div{display:grid;gap:4px;padding:9px;background:var(--ad-surface)}
.ad-stat-grid span{color:var(--ad-muted);font-family:var(--ad-font-mono);font-size:10px;text-transform:uppercase}
.ad-stat-grid b{font-size:22px}
.ad-score-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;color:var(--ad-muted);font-size:12px;text-transform:uppercase}
.ad-score-row meter{width:100%;height:8px}
.ad-shortcut-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.ad-shortcut-grid div{display:flex;align-items:center;gap:8px;padding:8px 9px;background:var(--ad-surface);font-size:13px}
.ad-shortcut-grid kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border:1px solid rgba(0,0,0,.16);border-radius:5px;background:var(--ad-paper);font-family:var(--ad-font-mono);font-size:12px}
.ad-check-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}
.ad-check-list li{position:relative;padding-left:18px}
.ad-check-list li::before{content:"";position:absolute;left:0;top:.58em;width:7px;height:7px;border-radius:999px;background:rgba(0,0,0,.2)}
.ad-check-list li.is-covered{color:var(--ad-ink)}
.ad-check-list li.is-covered::before{background:var(--ad-accent)}
.ad-alt-list{display:grid;gap:8px}
.ad-alt-list div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--ad-surface);font-size:13px}
.ad-outline-list{display:grid;gap:6px;max-height:240px;margin:0;padding:0;overflow:auto;list-style:none}
.ad-outline-list button{display:grid;grid-template-columns:34px 1fr;gap:8px;width:100%;padding:8px;border:0;background:var(--ad-surface);color:var(--ad-ink);text-align:left;cursor:pointer}
.ad-outline-list button:hover{color:var(--ad-accent)}
.ad-outline-list span{color:var(--ad-muted);font-family:var(--ad-font-mono);font-size:12px}
.ad-chip-row{display:flex;flex-wrap:wrap;gap:7px}
.ad-chip-row span{padding:5px 8px;border:1px solid rgba(0,0,0,.12);border-radius:999px;color:var(--ad-muted);font-size:12px}
.ad-command{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:6px;background:var(--ad-surface);color:var(--ad-ink);font-family:var(--ad-font-mono);font-size:12px;white-space:nowrap}
.ad-panel-hint{font-size:13px!important}
body[data-deck-mode=presenter] .ad-presenter-panel,body[data-deck-mode=creator] .ad-creator-panel{display:grid}
body[data-deck-mode=presenter] .ad-stage,body[data-deck-mode=creator] .ad-stage{right:420px}
body[data-compat-profile=rendered-file] .ad-slide{box-shadow:none;background:#fff}
@page{size:20in 11.25in;margin:0}
@media print{
html,body{width:1920px!important;height:auto!important;margin:0!important;overflow:visible!important;background:var(--ad-paper)!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.ad-dock,.ad-dock-zone,.ad-progress,.ad-overview,.ad-compare,.ad-print-help,.ad-blackout,.ad-spotlight,.ad-presenter-panel,.ad-creator-panel{display:none!important}
.agentdeck-app{position:static!important;width:1920px!important;height:auto!important;background:var(--ad-paper)!important}
.ad-stage,.ad-scaled-shell,.ad-scaled{position:static!important;display:block!important;width:1920px!important;height:auto!important;transform:none!important}
.ad-slide,.ad-slide[hidden]{position:relative!important;display:block!important;inset:auto!important;width:1920px!important;height:1080px!important;margin:0!important;overflow:hidden!important;break-after:page!important;page-break-after:always!important;box-shadow:none!important;transform:none!important}
.ad-slide:last-child{break-after:auto!important;page-break-after:auto!important}
}
@media (max-width:960px){.ad-dock{flex-wrap:wrap}}
@media (max-width:980px){.ad-compare{right:18px;left:18px;bottom:96px;width:auto}}
@media (max-width:760px){.ad-dock{bottom:10px;gap:6px}.ad-dock-zone{height:86px}.ad-toolbar-group{height:38px;padding:3px}.ad-dock button{height:30px;min-width:30px;padding:0 8px}.ad-dock button span,.ad-toolbar-icon{display:none}.ad-counter{width:44px;font-size:12px}.ad-stage{inset:18px 14px 76px}.ad-presenter-panel,.ad-creator-panel{left:10px;right:10px;top:10px;width:auto;max-height:42vh}body[data-deck-mode=presenter] .ad-stage,body[data-deck-mode=creator] .ad-stage{right:14px;top:45vh}}
`;

export const runtimeJs = `
(() => {
  const width = 1920;
  const height = 1080;
  const stage = document.querySelector('.ad-stage');
  const dock = document.querySelector('.ad-dock');
  const dockZone = document.querySelector('[data-dock-zone]');
  const shell = document.querySelector('[data-shell]');
  const scaled = document.querySelector('[data-scaled]');
  const slides = [...document.querySelectorAll('.ad-scaled > .ad-slide')];
  const overviewCards = [...document.querySelectorAll('[data-overview-index]')];
  const current = document.querySelector('[data-current]');
  const prevButton = document.querySelector('[data-action="prev"]');
  const nextButton = document.querySelector('[data-action="next"]');
  const playButton = document.querySelector('[data-action="play"]');
  const intervalButton = document.querySelector('[data-action="interval"]');
  const intervalLabel = document.querySelector('[data-interval-label]');
  const nextTitle = document.querySelector('[data-next-title]');
  const timer = document.querySelector('[data-timer]');
  const progressBar = document.querySelector('[data-progress-bar]');
  const overview = document.querySelector('[data-overlay="overview"]');
  const compare = document.querySelector('[data-overlay="compare"]');
  const compareNext = document.querySelector('[data-compare-next]');
  const printHelp = document.querySelector('[data-overlay="print-help"]');
  const blackout = document.querySelector('[data-overlay="blackout"]');
  const spotlight = document.querySelector('[data-overlay="spotlight"]');
  const startedAt = Date.now();
  let dockTimer = 0;
  let dockHideTimer = 0;
  let dockAutohide = false;
  let index = 0;
  let wheelAt = 0;
  let autoplayIntervalMs = 8000;
  let autoplayTimer = 0;
  function isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function shouldAutoHideDock() {
    return dockAutohide || isFullscreen();
  }
  function activateDock() {
    document.body.classList.add('is-dock-active');
    document.body.classList.remove('is-dock-hidden');
    clearTimeout(dockTimer);
    dockTimer = setTimeout(() => document.body.classList.remove('is-dock-active'), 3000);
    if (shouldAutoHideDock()) scheduleDockHide(isFullscreen() ? 1600 : 2000);
  }
  function scheduleDockHide(delay = 2000, force = false) {
    clearTimeout(dockHideTimer);
    if (!shouldAutoHideDock()) return;
    dockHideTimer = setTimeout(() => {
      if (force || (!dock?.matches(':hover') && !dock?.contains(document.activeElement))) {
        document.body.classList.add('is-dock-hidden');
        document.body.classList.remove('is-dock-active');
      }
    }, delay);
  }
  function setDockAutohide(next) {
    dockAutohide = next;
    document.body.classList.toggle('is-dock-autohide', next);
    document.body.classList.remove('is-dock-hidden');
    document.querySelectorAll('[data-action="dock-autohide"]').forEach((button) => {
      button.classList.toggle('is-active', next);
      button.setAttribute('aria-pressed', next ? 'true' : 'false');
      button.setAttribute('title', next ? 'Toolbar auto-hide on' : 'Auto-hide toolbar');
      button.setAttribute('aria-label', next ? 'Disable toolbar auto-hide' : 'Auto-hide toolbar');
    });
    clearTimeout(dockHideTimer);
    if (next) scheduleDockHide(2000, true);
    else if (isFullscreen()) scheduleDockHide(1600, true);
  }
  function syncFullscreenToolbar() {
    const fullscreen = isFullscreen();
    document.body.classList.toggle('is-fullscreen-toolbar-hidden', fullscreen);
    clearTimeout(dockHideTimer);
    if (fullscreen) {
      scheduleDockHide(450, true);
    } else {
      document.body.classList.remove('is-dock-hidden');
      activateDock();
    }
  }
  function tickTimer() {
    if (!timer) return;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    timer.textContent = mm + ':' + ss;
  }
  function setActionActive(action, active) {
    document.querySelectorAll('[data-action="' + action + '"]').forEach((button) => {
      button.classList.toggle('is-active', active);
    });
  }
  function toggleOverview(force) {
    if (!overview) return;
    const next = force ?? overview.hidden;
    overview.hidden = !next;
    document.body.classList.toggle('is-overview-open', next);
    setActionActive('overview', next);
  }
  function toggleCompare(force) {
    if (!compare) return;
    const next = force ?? compare.hidden;
    compare.hidden = !next;
    document.body.classList.toggle('is-compare-open', next);
    setActionActive('compare', next);
    if (next) syncCompareView();
  }
  function setAutoplayActive(next) {
    if (next) {
      clearInterval(autoplayTimer);
      autoplayTimer = setInterval(() => {
        show(index + 1);
      }, autoplayIntervalMs);
    } else {
      clearInterval(autoplayTimer);
      autoplayTimer = 0;
    }
    setActionActive('play', next);
    if (playButton) {
      playButton.setAttribute('aria-label', next ? 'Pause autoplay' : 'Start autoplay');
      playButton.setAttribute('title', next ? 'Pause autoplay' : 'Autoplay');
      playButton.querySelectorAll('[data-play-icon]').forEach((icon) => {
        icon.hidden = icon.getAttribute('data-play-icon') !== (next ? 'pause' : 'play');
      });
    }
  }
  function setAutoplayInterval(ms) {
    autoplayIntervalMs = ms;
    if (intervalLabel) intervalLabel.textContent = String(ms / 1000) + 's';
    if (intervalButton) intervalButton.title = 'Autoplay interval ' + String(ms / 1000) + 's';
    if (autoplayTimer) setAutoplayActive(true);
  }
  function cycleAutoplayInterval() {
    const options = [5000, 8000, 12000, 20000];
    const currentIndex = options.indexOf(autoplayIntervalMs);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
    setAutoplayInterval(options[nextIndex]);
  }
  function toggleAutoplay() {
    setAutoplayActive(!autoplayTimer);
  }
  function toggleBlackout(force) {
    if (!blackout) return;
    const next = force ?? blackout.hidden;
    blackout.hidden = !next;
    setActionActive('blackout', next);
  }
  function toggleSpotlight(force) {
    if (!spotlight) return;
    const next = force ?? spotlight.hidden;
    spotlight.hidden = !next;
    document.body.classList.toggle('is-spotlight-on', next);
    setActionActive('spotlight', next);
  }
  function hidePresentationOverlays() {
    toggleOverview(false);
    toggleCompare(false);
    if (printHelp) printHelp.hidden = true;
    toggleBlackout(false);
    toggleSpotlight(false);
  }
  function updateNavButtons() {
    if (prevButton) prevButton.disabled = index === 0;
    if (nextButton) nextButton.disabled = index === slides.length - 1 && !autoplayTimer;
  }
  function syncComparePane(target, slideIndex, label) {
    if (!target) return;
    target.replaceChildren();
    if (slideIndex < 0 || slideIndex >= slides.length) {
      const empty = document.createElement('div');
      empty.className = 'ad-compare-empty';
      empty.textContent = label;
      target.append(empty);
      return;
    }
    const source = slides[slideIndex];
    const clone = source.cloneNode(true);
    clone.hidden = false;
    clone.classList.add('ad-compare-slide');
    clone.style.transform = 'scale(' + (target.clientWidth / 1920) + ')';
    target.append(clone);
  }
  function syncCompareView() {
    if (!compare || compare.hidden) return;
    const nextIndex = index === slides.length - 1 ? (autoplayTimer ? 0 : -1) : index + 1;
    syncComparePane(compareNext, nextIndex, nextIndex === -1 ? 'End of deck' : 'Next');
  }
  function scale() {
    if (!stage || !scaled || !shell) return;
    const rect = stage.getBoundingClientRect();
    const value = Math.min(rect.width / width, rect.height / height);
    shell.style.width = (width * value) + 'px';
    shell.style.height = (height * value) + 'px';
    scaled.style.transform = 'scale(' + value + ')';
    scaled.style.width = width + 'px';
    scaled.style.height = height + 'px';
  }
  function show(next) {
    if (autoplayTimer) {
      index = ((next % slides.length) + slides.length) % slides.length;
    } else {
      index = Math.max(0, Math.min(slides.length - 1, next));
    }
    slides.forEach((slide, slideIndex) => { slide.hidden = slideIndex !== index; });
    overviewCards.forEach((card) => {
      card.classList.toggle('is-current', Number(card.getAttribute('data-overview-index')) === index);
    });
    document.querySelectorAll('[data-note]').forEach((note) => { note.hidden = Number(note.getAttribute('data-note')) !== index; });
    if (current) current.textContent = String(index + 1);
    if (progressBar) progressBar.style.width = (((index + 1) / slides.length) * 100) + '%';
    if (nextTitle) {
      const nextIndex = index === slides.length - 1 ? (autoplayTimer ? 0 : -1) : index + 1;
      nextTitle.textContent = nextIndex === -1 ? 'End' : slides[nextIndex]?.querySelector('h1')?.textContent || 'End';
    }
    updateNavButtons();
    syncCompareView();
    location.hash = '#/' + (index + 1);
  }
  function hashIndex() {
    const value = Number((location.hash.match(/#\\/(\\d+)/) || [])[1]);
    return Number.isFinite(value) && value > 0 ? value - 1 : 0;
  }
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action],[data-goto]');
    if (!target) return;
    activateDock();
    const action = target.getAttribute('data-action');
    if (target.hasAttribute('data-goto')) {
      show(Number(target.getAttribute('data-goto')));
      toggleOverview(false);
    }
    if (action === 'prev') show(index - 1);
    if (action === 'next') show(index + 1);
    if (action === 'restart') {
      show(0);
    }
    if (action === 'play') toggleAutoplay();
    if (action === 'interval') cycleAutoplayInterval();
    if (action === 'overview') toggleOverview();
    if (action === 'overview-close') toggleOverview(false);
    if (action === 'compare') toggleCompare();
    if (action === 'dock-autohide') setDockAutohide(!dockAutohide);
    if (action === 'print') {
      if (printHelp) printHelp.hidden = false;
    }
    if (action === 'print-close') {
      if (printHelp) printHelp.hidden = true;
    }
    if (action === 'print-confirm') {
      if (printHelp) printHelp.hidden = true;
      window.print();
    }
    if (action === 'blackout') toggleBlackout();
    if (action === 'spotlight') toggleSpotlight();
    if (action === 'theme') {
      const mode = target.getAttribute('data-theme-value') || 'light';
      document.body.dataset.colorMode = mode === 'dark' ? 'dark' : 'light';
      try { localStorage.setItem('agentdeck:colorMode', document.body.dataset.colorMode); } catch {}
      document.querySelectorAll('[data-action="theme"]').forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-theme-value') === mode);
      });
    }
    if (action === 'fullscreen') {
      if (isFullscreen()) await document.exitFullscreen?.();
      else await document.documentElement.requestFullscreen?.();
      syncFullscreenToolbar();
    }
  });
  document.addEventListener('fullscreenchange', syncFullscreenToolbar);
  document.addEventListener('webkitfullscreenchange', syncFullscreenToolbar);
  window.addEventListener('hashchange', () => show(hashIndex()));
  document.addEventListener('keydown', (event) => {
    activateDock();
    const key = event.key.toLowerCase();
    if (event.key === 'Escape') {
      hidePresentationOverlays();
      return;
    }
    if (key === 'o') toggleOverview();
    if (key === 'c') toggleCompare();
    if (key === 'p') toggleAutoplay();
    if (key === 'b') toggleBlackout();
    if (key === 'l') toggleSpotlight();
    if (key === 'f') document.querySelector('[data-action="fullscreen"]')?.click();
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') show(index + 1);
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') show(index - 1);
    if (event.key === 'Home') show(0);
    if (event.key === 'End') show(slides.length - 1);
  });
  document.addEventListener('wheel', (event) => {
    activateDock();
    const now = Date.now();
    if (now - wheelAt < 550 || Math.abs(event.deltaY) < 24) return;
    wheelAt = now;
    show(index + (event.deltaY > 0 ? 1 : -1));
  }, { passive: true });
  let touchStart = null;
  document.addEventListener('touchstart', (event) => { touchStart = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (touchStart === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
    if (Math.abs(delta) > 50) show(index + (delta < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  dock?.addEventListener('pointerenter', () => {
    clearTimeout(dockHideTimer);
    activateDock();
  });
  dock?.addEventListener('pointerleave', () => scheduleDockHide());
  dock?.addEventListener('focusin', () => {
    clearTimeout(dockHideTimer);
    activateDock();
  });
  dock?.addEventListener('focusout', () => scheduleDockHide());
  dockZone?.addEventListener('pointerenter', () => {
    if (!shouldAutoHideDock()) return;
    clearTimeout(dockHideTimer);
    activateDock();
  });
  window.addEventListener('resize', scale);
  window.addEventListener('resize', syncCompareView);
  document.addEventListener('mousemove', (event) => {
    if (spotlight && !spotlight.hidden) {
      document.documentElement.style.setProperty('--ad-spot-x', event.clientX + 'px');
      document.documentElement.style.setProperty('--ad-spot-y', event.clientY + 'px');
    }
  }, { passive: true });
  try {
    const savedMode = localStorage.getItem('agentdeck:colorMode');
    if (savedMode === 'light' || savedMode === 'dark') {
      document.body.dataset.colorMode = savedMode;
      document.querySelectorAll('[data-action="theme"]').forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-theme-value') === savedMode);
      });
    }
  } catch {}
  setInterval(tickTimer, 1000);
  setAutoplayInterval(autoplayIntervalMs);
  scale();
  tickTimer();
  activateDock();
  show(hashIndex());
})();
`;
