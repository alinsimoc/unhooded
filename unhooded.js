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
  const C = { log: '#ddd', info: '#8cf', warn: '#fc6', error: '#f66', debug: '#999' };
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
  const panel = h('div', 'position:fixed;left:0;right:0;bottom:0;height:50vh;z-index:2147483647;display:flex;flex-direction:column;background:#1e1e1e;color:#ddd;font:12px/1.4 ui-monospace,Menlo,monospace;border-top:1px solid #555');
  const hl = h('div', 'position:fixed;pointer-events:none;z-index:2147483646;background:rgba(80,140,255,.25);outline:1px solid #58f;display:none');
  const bar = h('div', 'display:flex;flex:none;overflow-x:auto;border-bottom:1px solid #444');
  // Drag handle: pointer events cover touch and mouse; touch-action:none stops the page scrolling mid-drag.
  const grip = h('div', 'flex:none;height:18px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;touch-action:none;background:#252525');
  grip.append(h('div', 'width:36px;height:4px;border-radius:2px;background:#666'));
  grip.onpointerdown = e => {
    grip.setPointerCapture(e.pointerId);
    grip.onpointermove = e => { panel.style.height = Math.min(Math.max(innerHeight - e.clientY, 60), innerHeight - 20) + 'px'; };
  };
  grip.onpointerup = grip.onpointercancel = () => { grip.onpointermove = null; };
  panel.append(grip, bar);
  root.append(hl, panel);

  const btn = (label, onclick, parent = bar) => {
    const b = h('button', 'background:#333;color:#ddd;border:0;border-right:1px solid #444;padding:8px 12px;font:inherit;flex:none', label);
    b.onclick = onclick;
    parent.append(b);
    return b;
  };
  const row = (parent, text, color = C.log) => {
    if (parent.childElementCount >= 500) parent.firstChild.remove(); // cap long sessions
    const r = h('div', 'padding:3px 6px;border-bottom:1px solid #2c2c2c;white-space:pre-wrap;word-break:break-all;color:' + color, clip(text));
    parent.append(r);
    return r;
  };
  const field = (placeholder, css) => {
    const f = h('input', 'flex:none;background:#111;color:#fff;border:0;padding:8px;font:inherit;font-size:16px;outline:none;' + css);
    f.placeholder = placeholder;
    f.setAttribute('autocapitalize', 'off');
    f.autocomplete = 'off';
    f.spellcheck = false;
    f.enterKeyHint = 'go';
    return f;
  };
  const tabs = {};
  const tab = (name, onShow) => {
    const body = h('div', 'flex:1;min-height:0;overflow:auto;flex-direction:column;display:none');
    panel.append(body);
    tabs[name] = { body, onShow, b: btn(name, () => show(name)) };
    return body;
  };
  const show = name => {
    for (const k in tabs) {
      tabs[k].body.style.display = k === name ? 'flex' : 'none';
      tabs[k].b.style.background = k === name ? '#555' : '#333';
    }
    tabs[name].onShow?.();
  };

  // --- console ---
  const con = tab('Console');
  const logs = h('div', 'flex:1;min-height:0;overflow:auto');
  const inp = field('> expression', 'border-top:1px solid #444');
  con.append(logs, inp);
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
  inp.onkeydown = e => {
    if (e.key === 'Enter' && inp.value.trim()) { run(inp.value); inp.value = ''; }
  };

  // --- elements ---
  const els = tab('Elements');
  const tools = h('div', 'position:sticky;top:0;display:flex;flex-wrap:wrap;background:#1e1e1e;border-bottom:1px solid #444');
  const info = h('div');
  const css = field('add css, e.g. color:red', 'border-bottom:1px solid #444');
  css.onkeydown = e => {
    if (e.key === 'Enter' && cur) { cur.style.cssText += ';' + css.value; css.value = ''; select(cur); }
  };
  els.append(tools, css, info);

  let picking = false, cur = null;
  const pickBtn = btn('Pick', () => { picking = true; pickBtn.textContent = 'Tap an element…'; }, tools);
  for (const [label, prop] of [['Parent', 'parentElement'], ['Child', 'firstElementChild'], ['Prev', 'previousElementSibling'], ['Next', 'nextElementSibling']])
    btn(label, () => cur?.[prop] && select(cur[prop]), tools);
  btn('Log', () => cur && console.log(cur), tools);

  const place = () => {
    if (!cur?.isConnected || host.style.display === 'none') return (hl.style.display = 'none');
    const r = cur.getBoundingClientRect();
    Object.assign(hl.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  addEventListener('scroll', place, true);
  addEventListener('resize', place);

  const select = el => {
    cur = window.$0 = el;
    place();
    info.replaceChildren();
    const path = [];
    for (let e = el; e && path.length < 5; e = e.parentElement) path.unshift(fmt(e));
    row(info, path.join(' › '), C.info);
    const r = el.getBoundingClientRect();
    row(info, `${Math.round(r.width)} × ${Math.round(r.height)} at (${Math.round(r.left)}, ${Math.round(r.top)})`);
    for (const a of el.attributes) row(info, `${a.name}="${a.value}"`, C.warn);
    const cs = getComputedStyle(el);
    row(info, ['display', 'position', 'box-sizing', 'width', 'height', 'margin', 'padding', 'border', 'color', 'background-color', 'font', 'z-index', 'overflow', 'opacity']
      .map(p => `${p}: ${cs.getPropertyValue(p)}`).join('\n'), '#bbb');
    row(info, el.outerHTML, '#888');
  };
  addEventListener('click', e => {
    if (!picking || e.target === host) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    picking = false;
    pickBtn.textContent = 'Pick';
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
      row(st, name, C.info);
      try {
        const s = window[name];
        for (let i = 0; i < s.length; i++) row(st, s.key(i) + ' = ' + s.getItem(s.key(i)));
      } catch (e) { row(st, String(e), C.error); }
    }
    row(st, 'cookies', C.info);
    for (const c of document.cookie.split('; ').filter(Boolean)) row(st, c);
  });

  // --- mount ---
  const toggle = () => { host.style.display = host.style.display === 'none' ? '' : 'none'; place(); };
  btn('✕', toggle).style.marginLeft = 'auto';
  window.__unhooded = { toggle };
  document.documentElement.append(host);
  show('Console');
  log('Unhooded ready. Earlier logs/requests were not captured.', C.debug);
})();
