// Unhooded: tiny mobile devtools. Built to survive strict CSP / Trusted Types:
// no external loads, no innerHTML, styles only via CSSOM (el.style), and
// console eval falls back to plain property paths when the page blocks eval.
(() => {
  if (window.__unhooded) return window.__unhooded.toggle();

  const h = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
  // GitHub dark palette: G for surfaces, C for text by log level.
  const G = { canvas: '#010409', bg: '#0d1117', surface: '#151b23', active: '#212830', line: '#3d444d', fg: '#e6edf3', muted: '#9198a1', text: '#c9d1d9', faint: '#656c76', blue: '#4493f8', tab: '#f78166', green: '#238636', attr: '#79c0ff' };
  const C = { log: G.fg, info: G.blue, warn: '#d29922', error: '#f85149', debug: G.muted };
  const clip = (s, n = 5000) => (s.length > n ? s.slice(0, n) + '…' : s);
  const fmt = v => {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.stack && v.stack.includes(v.message) ? v.stack : v + '\n' + (v.stack || '');
    if (v instanceof Element) {
      const cls = typeof v.className === 'string' && v.className.trim();
      return '<' + v.localName + (v.id ? '#' + v.id : '') + (cls ? '.' + cls.split(/\s+/).join('.') : '') + '>';
    }
    if (typeof v === 'function') return 'ƒ ' + v.name + '()';
    if (v instanceof Map || v instanceof Set) return v.constructor.name + ' ' + fmt([...v]);
    if (v && typeof v === 'object') {
      try { return JSON.stringify(v, null, 2) ?? String(v); }
      catch { return Object.prototype.toString.call(v) + ' { ' + Object.keys(v).slice(0, 30).join(', ') + ' }'; }
    }
    return String(v);
  };

  // --- shell ---
  const host = h('div', 'all:initial');
  const root = host.attachShadow({ mode: 'closed' });
  for (const ev of ['keydown', 'keyup', 'keypress']) host.addEventListener(ev, e => e.stopPropagation());
  const panel = h('div', `position:fixed;left:0;right:0;bottom:0;height:50vh;z-index:2147483647;display:flex;flex-direction:column;background:${G.bg};color:${G.fg};font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid ${G.line}`);
  // Box-model highlight (DevTools colours): nested layers, each a translucent border — margin › border › padding — around the content.
  const BOX = { margin: '#f6b26b', border: '#ffe599', padding: '#93c47d', content: '#6fa8dc' };
  const layerCss = 'box-sizing:border-box;border-style:solid;width:100%;height:100%';
  const hl = h('div', `position:fixed;pointer-events:none;z-index:2147483646;display:none;${layerCss};border-color:${BOX.margin}80`);
  const hlBorder = h('div', `${layerCss};border-color:${BOX.border}80`);
  const hlPad = h('div', `${layerCss};border-color:${BOX.padding}80;background:${BOX.content}80;background-clip:content-box`);
  hl.append(hlBorder);
  hlBorder.append(hlPad);
  const bar = h('div', `display:flex;flex:none;overflow-x:auto;border-bottom:1px solid ${G.line}`);
  // Drag handle: pointer events cover touch and mouse; touch-action:none stops the page scrolling mid-drag.
  const grip = h('div', `flex:none;height:18px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;touch-action:none;background:${G.surface};border-bottom:1px solid ${G.line}`);
  grip.append(h('div', `width:36px;height:4px;border-radius:2px;background:${G.line}`));
  // Pin the panel to what's actually on screen (the visual viewport). A page wider than the screen,
  // or pinch-zoom, grows the layout viewport that position:fixed uses, which would push a plain
  // bottom panel off-screen. We place it in page px and counter-scale so it stays screen-sized.
  let panelH = innerHeight / 2; // on-screen px
  const fit = () => {
    const v = window.visualViewport;
    if (!v) return (panel.style.height = panelH + 'px'); // old browsers: plain fixed bottom panel
    const k = v.scale, h = Math.min(panelH, v.height * k - 20);
    Object.assign(panel.style, {
      left: v.offsetLeft + 'px', top: v.offsetTop + v.height - h / k + 'px', right: 'auto', bottom: 'auto',
      width: v.width * k + 'px', height: h + 'px', transform: `scale(${1 / k})`, transformOrigin: '0 0',
    });
  };
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  grip.onpointerdown = e => {
    grip.setPointerCapture(e.pointerId);
    grip.onpointermove = e => {
      const v = window.visualViewport, k = v ? v.scale : 1;
      const bottom = v ? v.offsetTop + v.height : innerHeight;
      panelH = Math.max((bottom - e.clientY) * k, 60);
      fit();
    };
  };
  grip.onpointerup = grip.onpointercancel = () => { grip.onpointermove = null; };
  panel.append(grip, bar);
  root.append(hl, panel);

  const btn = (label, onclick, css = '') => {
    const b = h('button', `background:${G.surface};color:${G.fg};border:0;border-right:1px solid ${G.line};padding:8px 12px;font:inherit;flex:none;${css}`, label);
    b.onclick = onclick;
    bar.append(b);
    return b;
  };
  const row = (parent, text, color = C.log, max) => {
    if (parent.childElementCount >= 500) parent.firstChild.remove(); // cap long sessions
    const r = h('div', `padding:6px 10px;border-bottom:1px solid ${G.active};white-space:pre-wrap;overflow-wrap:anywhere;color:${color}`, clip(text, max));
    parent.append(r);
    return r;
  };
  const field = (placeholder, css, tag = 'input') => {
    const f = h(tag, `flex:none;background:${G.canvas};color:${G.fg};border:0;padding:10px;font:inherit;font-size:16px;outline:none;${css}`);
    f.placeholder = placeholder;
    f.setAttribute('autocapitalize', 'off');
    f.autocomplete = 'off';
    f.spellcheck = false;
    f.enterKeyHint = 'go';
    return f;
  };
  // Section heading shared by every tab: small, muted, uppercase.
  const heading = (parent, text) => parent.append(h('div', `padding:12px 10px 2px;color:${G.muted};font-size:11px;letter-spacing:.06em;text-transform:uppercase`, text));
  const tabs = {};
  const tab = (name, onShow) => {
    const body = h('div', 'flex:1;min-height:0;overflow:auto;flex-direction:column;display:none');
    panel.append(body);
    tabs[name] = { body, onShow, b: btn(name, () => show(name)) };
    return body;
  };
  let active = '';
  const show = name => {
    if (name !== 'Elements') picking = false; // taps on the page work normally outside Elements
    active = name;
    for (const k in tabs) {
      tabs[k].body.style.display = k === name ? 'flex' : 'none';
      tabs[k].b.style.background = k === name ? G.active : G.surface;
      tabs[k].b.style.boxShadow = k === name ? `inset 0 -2px ${G.tab}` : 'none';
    }
    tabs[name].onShow?.();
    place(); // the highlight only shows on the Elements tab
  };

  // Eruda-style editor docked at the bottom of a tab: one line until tapped, then a
  // multi-line box with Cancel / <action>. Ctrl/⌘+Enter submits; plain Enter adds a new line.
  const editor = (placeholder, label, onSubmit) => {
    const box = h('div', `flex:none;border-top:1px solid ${G.line};background:${G.canvas}`);
    const inp = field(placeholder, 'display:block;width:100%;box-sizing:border-box;height:40px;resize:none;transition:height .15s', 'textarea');
    const acts = h('div', 'display:none;justify-content:flex-end;gap:8px;padding:0 10px 10px');
    const expand = on => {
      inp.style.height = on ? '120px' : '40px';
      acts.style.display = on ? 'flex' : 'none';
      if (!on) inp.blur();
    };
    const submit = () => {
      if (inp.value.trim()) onSubmit(inp.value);
      inp.value = '';
      expand(false);
    };
    for (const [text, bg, onclick] of [['Cancel', G.surface, () => expand(false)], [label, G.green, submit]]) {
      const b = h('button', `flex:1;max-width:220px;padding:8px 16px;border:1px solid ${G.line};border-radius:6px;background:${bg};color:${G.fg};font:inherit`, text);
      b.onclick = onclick;
      acts.append(b);
    }
    inp.onfocus = () => expand(true);
    inp.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); };
    box.append(inp, acts);
    return box;
  };

  // --- console ---
  const con = tab('Console');
  const logs = h('div', 'flex:1;min-height:0;overflow:auto');
  con.append(logs, editor('> expression', 'Execute', src => run(src)));
  const log = (text, color) => { row(logs, text, color); logs.scrollTop = logs.scrollHeight; };

  for (const k in C) {
    const orig = console[k];
    console[k] = function (...a) { log(a.map(fmt).join(' '), C[k]); return orig.apply(this, a); };
  }
  addEventListener('error', e => log(e.message + (e.filename ? ` (${e.filename}:${e.lineno})` : ''), C.error));
  addEventListener('unhandledrejection', e => log('Unhandled rejection: ' + fmt(e.reason), C.error));

  const result = v => {
    log(fmt(v));
    if (v && typeof v.then === 'function') v.then(r => log('⇒ ' + fmt(r)), e => log('⇒ ' + fmt(e), C.error));
  };
  let canEval = true;
  try { (0, eval)('1'); } catch { canEval = false; }
  const run = src => {
    log('> ' + src, C.info);
    if (canEval) {
      try { result((0, eval)(src)); } catch (e) { log(fmt(e), C.error); }
      return;
    }
    const path = src.trim().replace(/;$/, '');
    if (!/^[\w$.[\]'"]+$/.test(path)) return log("This page's CSP blocks eval. Property paths still work, e.g. $0.style or location.href", C.warn);
    try { result(path.split(/[.[\]'"]+/).filter(Boolean).reduce((o, k) => o[k], window)); }
    catch (e) { log(fmt(e), C.error); }
  };

  // --- elements ---
  const els = tab('Elements', () => cur || (picking = true)); // nothing selected: go straight into pick mode
  // Sticky header: the element's path as tappable chips (jump to any ancestor), plus Clear.
  const tools = h('div', `position:sticky;top:0;z-index:1;display:flex;align-items:center;background:${G.bg};border-bottom:1px solid ${G.line}`);
  // Horizontally scrolling chip rows fade out on whichever side has more to scroll to.
  const fade = el => {
    const l = el.scrollLeft > 1, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    el.style.webkitMaskImage = el.style.maskImage =
      `linear-gradient(to right, ${l ? 'transparent' : '#000'}, #000 24px, #000 calc(100% - 24px), ${r ? 'transparent' : '#000'})`;
  };
  const chipRow = css => {
    const el = h('div', `display:flex;gap:6px;overflow-x:auto;white-space:nowrap;scrollbar-width:none;${css}`);
    el.onscroll = () => fade(el);
    return el;
  };
  const crumbs = chipRow('flex:1;min-width:0;padding:8px 10px');
  const chip = (label, onclick, css = '') => {
    const b = h('button', `flex:none;padding:6px 10px;border:1px solid ${G.line};border-radius:6px;background:none;color:${C.info};font:inherit;${css}`, label);
    b.onclick = onclick;
    return b;
  };
  const info = h('div');
  const elScroll = h('div', 'position:relative;flex:1;min-height:0;overflow:auto');
  // Styles applied from the editor, per element: prop -> { value, important, on, orig, origImportant }.
  // orig is the element's own inline value before we touched it, restored when a rule is switched off.
  const edits = new WeakMap();
  const setStyle = (el, prop, d) => {
    if (d.on) el.style.setProperty(prop, d.value, d.important ? 'important' : '');
    else if (d.orig) el.style.setProperty(prop, d.orig, d.origImportant);
    else el.style.removeProperty(prop);
    if (!el.style.length) el.removeAttribute('style'); // don't leave an empty style="" behind
  };
  const applyCss = text => {
    if (!cur) return;
    const list = edits.get(cur) || new Map();
    edits.set(cur, list);
    for (const decl of text.split(';')) {
      const i = decl.indexOf(':'); // first colon only, so values like url(http://…) survive
      const prop = decl.slice(0, i).trim().toLowerCase();
      const raw = decl.slice(i + 1).trim();
      if (i < 0 || !prop || !raw) continue;
      const prev = list.get(prop);
      const d = {
        value: raw.replace(/\s*!important$/i, ''),
        important: /!important$/i.test(raw),
        on: true,
        orig: prev ? prev.orig : cur.style.getPropertyValue(prop),
        origImportant: prev ? prev.origImportant : cur.style.getPropertyPriority(prop),
      };
      list.set(prop, d);
      setStyle(cur, prop, d);
    }
    select(cur);
  };
  const css = editor('add css, e.g. color:red', 'Apply', applyCss);
  elScroll.append(tools, info);
  els.append(elScroll, css);

  let picking = false, cur = null;
  // Pick mode is on whenever Elements is open with nothing selected; leaving the tab turns it off.

  // Empty state: nothing selected yet, so picking is the one obvious next step.
  // Centred in the panel and set in the system UI font, like the website, not the code font.
  const empty = h('div', 'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:16px;text-align:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif');
  empty.append(
    h('div', `font-size:16px;font-weight:600;color:${G.fg}`, 'No element selected'),
    h('div', `max-width:280px;color:${G.muted}`, 'Tap anything on the page to see its box model, attributes and styles.'),
  );
  info.append(empty);
  tools.append(crumbs, chip('Clear', () => {
    cur = null;
    info.replaceChildren(empty);
    place();
    syncNav();
    picking = true;
  }, `margin-right:10px;color:${G.fg};background:${G.surface}`));
  // Until something is picked, the empty state's big button is the only control.
  const syncNav = () => {
    tools.style.display = cur ? 'flex' : 'none';
    css.style.display = cur ? '' : 'none';
  };
  syncNav();

  // [top, right, bottom, left] for margin-*, border-*-width, padding-*
  const sides = (cs, prop) => ['top', 'right', 'bottom', 'left'].map(s => parseFloat(cs.getPropertyValue(prop.replace('*', s))) || 0);
  const boxOf = el => {
    const cs = getComputedStyle(el);
    return { cs, r: el.getBoundingClientRect(), m: sides(cs, 'margin-*'), b: sides(cs, 'border-*-width'), p: sides(cs, 'padding-*') };
  };
  const widths = a => a.map(v => Math.max(v, 0) + 'px').join(' '); // negative margins can't be drawn

  const place = () => {
    if (!cur?.isConnected || host.style.display === 'none' || active !== 'Elements') return (hl.style.display = 'none');
    const { r, m, b, p } = boxOf(cur);
    const [mt, mr, mb, ml] = m.map(v => Math.max(v, 0));
    Object.assign(hl.style, { display: 'block', left: r.left - ml + 'px', top: r.top - mt + 'px', width: r.width + ml + mr + 'px', height: r.height + mt + mb + 'px', borderWidth: widths(m) });
    hlBorder.style.borderWidth = widths(b);
    hlPad.style.borderWidth = widths(p);
  };

  // Box model, radius and colour helpers.
  const px = v => +parseFloat(v).toFixed(1);
  const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']; // display order: a 2×2 grid
  // rgb()/rgba() → #rrggbb(aa); other spaces (oklch, color()) are shown as the browser reports them.
  const hex = c => {
    const n = c.match(/^rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:[,/] ?([\d.]+))?\)$/);
    if (!n) return c;
    const a = n[4] == null ? 1 : +n[4];
    return '#' + [n[1], n[2], n[3], ...(a < 1 ? [a * 255] : [])].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  };
  const painted = c => c !== 'transparent' && !/[,/]\s*0\)$/.test(c); // fully transparent colours get no swatch
  const swatch = c => {
    const e = h('span', 'flex:none;width:10px;height:10px;border-radius:2px;border:1px solid rgba(255,255,255,.25)');
    e.style.backgroundColor = c;
    return e;
  };

  // DevTools-style box-model diagram: each layer is a 3x3 grid, its four values around the next layer in.
  // A layer on the panel (transparent) uses the panel's greys; layers on a colour fill use dark text.
  const layer = (name, bg, vals, inner) => {
    const onPanel = bg === 'transparent';
    const d = h('div', `position:relative;display:grid;grid-template:auto auto auto/auto minmax(0,1fr) auto;align-items:center;justify-items:center;gap:2px 3px;padding:2px 3px;background:${bg};color:${onPanel ? G.text : G.canvas};border:1px dashed ${onPanel ? G.muted : '#0005'}`);
    const v = (n, area) => d.append(h('div', `grid-area:${area}`, n ? String(n) : '–'));
    d.append(h('div', `position:absolute;left:4px;top:2px;font-size:9px;color:${onPanel ? G.muted : G.canvas}`, name));
    v(vals[0], '1/2'), v(vals[3], '2/1'), v(vals[1], '2/3'), v(vals[2], '3/2');
    inner.style.cssText += ';grid-area:2/2;justify-self:stretch';
    d.append(inner);
    return d;
  };
  const diagram = ({ cs, r, m, b, p }) => {
    // Content size is what's inside the padding, like DevTools. Fills at 75% so they're not too bright on the dark panel.
    const cw = px(r.width - b[1] - b[3] - p[1] - p[3]), ch = px(r.height - b[0] - b[2] - p[0] - p[2]);
    const content = h('div', `padding:4px;background:${BOX.content}bf;border:1px solid #0005`, `${cw} × ${ch}`);
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const wrap = h('div', `padding:10px;font-size:11px;border-bottom:1px solid ${G.active}`);
    // Fills the panel on phones; on wider panels it stops at a readable width, left-aligned.
    const body = h('div', 'max-width:400px');
    wrap.append(body);
    body.append(
      // Outermost ring: distance from the element's border box to each viewport edge, named after its positioning.
      layer(cs.position === 'static' ? 'position' : `position: ${cs.position}`, 'transparent', [r.top, vw - r.right, vh - r.bottom, r.left].map(px),
        layer('margin', BOX.margin + 'bf', m.map(px), layer('border', BOX.border + 'bf', b.map(px), layer('padding', BOX.padding + 'bf', p.map(px), content)))),
    );
    // Radius, like Figma: a 2×2 grid laid out like the corners, each value next to an icon of its own
    // corner (rounded or square), values facing inward.
    const rad = CORNERS.map(c => cs.getPropertyValue(`border-${c}-radius`).split(' ')[0]); // elliptical corners: horizontal part
    if (rad.some(v => parseFloat(v))) {
      const grid = h('div', 'display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;align-items:center;margin-top:10px');
      CORNERS.forEach((corner, i) => {
        const [vert, hz] = corner.split('-');
        const icon = h('span', `flex:none;width:8px;height:8px;box-sizing:border-box;border:0 solid ${G.muted};border-${vert}-width:1.5px;border-${hz}-width:1.5px;border-${corner}-radius:${parseFloat(rad[i]) ? 4 : 0}px`);
        const value = h('span', `color:${G.text}`, rad[i]);
        const cell = h('div', `display:flex;align-items:center;gap:6px;white-space:nowrap;justify-self:${hz === 'right' ? 'end' : 'start'}`);
        cell.append(...(hz === 'right' ? [value, icon] : [icon, value]));
        grid.append(cell);
      });
      body.append(grid);
    }
    return wrap;
  };
  addEventListener('scroll', place, true);
  addEventListener('resize', place);

  const select = el => {
    const keep = el === cur ? elScroll.scrollTop : 0; // re-rendering the same element keeps your place
    cur = window.$0 = el;
    place();
    info.replaceChildren();
    crumbs.replaceChildren();
    for (let e = el; e; e = e.parentElement) crumbs.prepend(chip(clip(fmt(e), 40), () => select(e), e === el ? `background:${G.active};color:${G.fg}` : ''));
    // Every section gets the same muted title.
    const title = text => heading(info, text);
    // Children right under the breadcrumb, as the same chips: up and down the tree sit together.
    const kids = [...el.children].filter(c => c !== host);
    if (kids.length) {
      title(`Children (${kids.length})`);
      const row = chipRow(`padding:4px 10px 10px;border-bottom:1px solid ${G.active}`);
      for (const c of kids.slice(0, 50)) row.append(chip(clip(fmt(c), 40), () => select(c)));
      if (kids.length > 50) row.append(h('span', `flex:none;align-self:center;color:${G.muted}`, `+${kids.length - 50} more`));
      info.append(row);
      fade(row);
    }
    title('Box model');
    const metrics = boxOf(el);
    info.append(diagram(metrics));
    const list = edits.get(el);
    if (list?.size) {
      title('Applied styles');
      const sec = h('div', `padding:2px 10px 8px;border-bottom:1px solid ${G.active}`);
      for (const [prop, d] of list) {
        const lab = h('label', 'display:flex;align-items:center;gap:10px;padding:4px 0;cursor:pointer');
        const box = h('input', `accent-color:${G.green};width:18px;height:18px;margin:0;flex:none`);
        box.type = 'checkbox';
        box.checked = d.on;
        box.onchange = () => {
          d.on = box.checked;
          setStyle(el, prop, d);
          select(el);
        };
        const ok = CSS.supports(prop, d.value);
        const del = h('button', `margin-left:auto;padding:2px 8px;border:0;background:none;color:${G.muted};font:inherit;font-size:16px;line-height:1`, '×');
        del.setAttribute('aria-label', `Remove ${prop}`);
        del.onclick = e => {
          e.preventDefault(); // don't let the label toggle the checkbox
          setStyle(el, prop, { ...d, on: false }); // restores the element's own value, if any
          list.delete(prop);
          select(el);
        };
        lab.append(box, h('span', `color:${ok ? C.log : C.error};${d.on ? '' : 'opacity:.45;text-decoration:line-through'}`, `${prop}: ${d.value}${d.important ? ' !important' : ''}`), del);
        sec.append(lab);
      }
      info.append(sec);
    }
    // The style attribute is redundant next to Applied styles, so it's only listed when there are none.
    const attrs = [...el.attributes].filter(a => a.name !== 'style' || !list?.size);
    if (attrs.length) title('Attributes');
    for (const a of attrs) row(info, `${a.name}="${a.value}"`, G.attr);
    const { cs } = metrics;
    title('Computed styles');
    // Label/value grid; colour properties get a swatch, and rgb values are shown as hex.
    const swatchOf = { color: cs.color, 'background-color': cs.backgroundColor, border: cs.borderTopColor };
    const grid = h('div', `display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:6px 10px 10px;border-bottom:1px solid ${G.active}`);
    for (const prop of ['display', 'position', 'box-sizing', 'width', 'height', 'margin', 'padding', 'border', 'color', 'background-color', 'font', 'z-index', 'overflow', 'opacity']) {
      const v = cs.getPropertyValue(prop), c = swatchOf[prop];
      const val = h('div', `display:flex;align-items:center;gap:6px;min-width:0;overflow-wrap:anywhere;color:${G.text}`);
      if (c && painted(c)) val.append(swatch(c));
      val.append(h('span', '', v.replace(/rgba?\([^)]*\)/g, hex)));
      grid.append(h('div', `color:${G.muted}`, prop), val);
    }
    info.append(grid);
    title('HTML');
    row(info, el.outerHTML, G.muted, Infinity); // full markup, never clipped
    syncNav();
    crumbs.scrollLeft = crumbs.scrollWidth; // keep the current element's chip in view
    fade(crumbs);
    elScroll.scrollTop = keep;
  };
  addEventListener('click', e => {
    if (!picking || e.target === host) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    picking = false;
    select(e.target);
  }, true);

  // --- network ---
  const net = tab('Network');
  const req = (method, url) => {
    let head = `… ${method} ${url}`, open = false;
    const r = row(net, head, C.debug);
    const t = performance.now();
    r.done = status => {
      head = `${status || 'ERR'} ${method} ${url}  ${Math.round(performance.now() - t)}ms`;
      r.textContent = clip(head);
      r.style.color = status && status < 400 ? C.log : C.error;
    };
    r.onclick = () => { open = !open; r.textContent = clip(open ? head + '\n\n' + (r.body ?? '(no body)') : head); };
    return r;
  };
  const ofetch = window.fetch;
  window.fetch = function (input, init) {
    const r = req((init?.method || input?.method || 'GET').toUpperCase(), String(input?.url || input));
    return ofetch.apply(this, arguments).then(res => {
      r.done(res.status);
      const type = res.headers.get('content-type') || '';
      if (/json|text|xml|javascript/.test(type) && !/event-stream/.test(type)) res.clone().text().then(b => (r.body = clip(b)), () => {});
      else r.body = `[${type || 'unknown type'}]`;
      return res;
    }, err => { r.done(0); r.body = String(err); throw err; });
  };
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__uh = [String(m).toUpperCase(), String(u)]; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__uh) {
      const r = req(...this.__uh);
      this.addEventListener('loadend', () => {
        r.done(this.status);
        r.body = this.responseType === '' || this.responseType === 'text' ? clip(this.responseText) : `[${this.responseType}]`;
      });
    }
    return xs.apply(this, arguments);
  };

  // --- storage ---
  const st = tab('Storage', () => {
    st.replaceChildren();
    for (const name of ['localStorage', 'sessionStorage']) {
      heading(st, name);
      try {
        const s = window[name];
        for (let i = 0; i < s.length; i++) row(st, s.key(i) + ' = ' + s.getItem(s.key(i)));
        if (!s.length) row(st, 'empty', G.faint); // keeps the divider between sections
      } catch (e) { row(st, String(e), C.error); }
    }
    heading(st, 'cookies');
    const cookies = document.cookie.split('; ').filter(Boolean);
    for (const c of cookies) row(st, c);
    if (!cookies.length) row(st, 'empty', G.faint);
  });

  // --- mount ---
  const toggle = () => {
    host.style.display = host.style.display === 'none' ? '' : 'none';
    if (host.style.display === 'none') picking = false;
    place();
  };
  // Blended close button; right inset matches the space above/below the ×.
  btn('×', toggle, `margin-left:auto;position:sticky;right:0;background:${G.bg};border-right:0;color:${G.muted};font-size:20px;line-height:1;padding:4px 10px 4px 14px`)
    .setAttribute('aria-label', 'Close Unhooded');
  window.__unhooded = { toggle };
  document.documentElement.append(host);
  fit();
  show('Console');
  log('Unhooded ready. Earlier logs/requests were not captured.', C.debug);
})();
