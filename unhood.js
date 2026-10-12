// Unhood: tiny mobile devtools. Built to survive strict CSP / Trusted Types:
// no external loads, no innerHTML, styles only via CSSOM (el.style), and
// console eval falls back to plain property paths when the page blocks eval.
(() => {
  if (window.__unhood) return window.__unhood.toggle();

  const h = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
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
  panel.append(bar);
  root.append(hl, panel);

  const btn = (label, onclick, parent = bar) => {
    const b = h('button', 'background:#333;color:#ddd;border:0;border-right:1px solid #444;padding:8px 12px;font:inherit;flex:none', label);
    b.onclick = onclick;
    parent.append(b);
    return b;
  };
  const row = (parent, text, color = '#ddd') => {
    const r = h('div', 'padding:3px 6px;border-bottom:1px solid #2c2c2c;white-space:pre-wrap;word-break:break-all;color:' + color, clip(text));
    parent.append(r);
    return r;
  };
  const tabs = {};
  const tab = (name, display = 'block', onShow) => {
    const body = h('div', 'flex:1;min-height:0;overflow:auto;flex-direction:column;display:none');
    panel.append(body);
    tabs[name] = { body, display, onShow, b: btn(name, () => show(name)) };
    return body;
  };
  const show = name => {
    for (const k in tabs) {
      tabs[k].body.style.display = k === name ? tabs[k].display : 'none';
      tabs[k].b.style.background = k === name ? '#555' : '#333';
    }
    tabs[name].onShow?.();
  };

  // --- console ---
  const con = tab('Console', 'flex');
  const logs = h('div', 'flex:1;min-height:0;overflow:auto');
  const inp = h('input', 'flex:none;background:#111;color:#fff;border:0;border-top:1px solid #444;padding:8px;font:16px ui-monospace,Menlo,monospace;outline:none');
  inp.placeholder = '> expression';
  inp.setAttribute('autocapitalize', 'off');
  inp.autocomplete = 'off';
  inp.spellcheck = false;
  inp.enterKeyHint = 'go';
  con.append(logs, inp);
  const log = (text, color) => { row(logs, text, color); logs.scrollTop = logs.scrollHeight; };

  const colors = { log: '#ddd', info: '#8cf', warn: '#fc6', error: '#f66', debug: '#999' };
  for (const k in colors) {
    const orig = console[k];
    console[k] = function (...a) { log(a.map(fmt).join(' '), colors[k]); return orig.apply(this, a); };
  }
  addEventListener('error', e => log(e.message + (e.filename ? ` (${e.filename}:${e.lineno})` : ''), '#f66'));
  addEventListener('unhandledrejection', e => log('Unhandled rejection: ' + fmt(e.reason), '#f66'));

  const result = v => {
    log(fmt(v));
    if (v && typeof v.then === 'function') v.then(r => log('⇒ ' + fmt(r)), e => log('⇒ ' + fmt(e), '#f66'));
  };
  const run = src => {
    log('> ' + src, '#8cf');
    try { return result((0, eval)(src)); }
    catch (e) {
      if (!(e instanceof EvalError) && !/unsafe-eval|Content.Security|CSP|Trusted/i.test(e.message)) return log(fmt(e), '#f66');
    }
    const path = src.trim().replace(/;$/, '');
    if (!/^[\w$.[\]'"]+$/.test(path)) return log("This page's CSP blocks eval. Property paths still work, e.g. $0.style or location.href", '#fc6');
    try { result(path.split(/[.[\]'"]+/).filter(Boolean).reduce((o, k) => o[k], window)); }
    catch (e) { log(fmt(e), '#f66'); }
  };
  inp.onkeydown = e => {
    if (e.key === 'Enter' && inp.value.trim()) { run(inp.value); inp.value = ''; }
  };

  // --- elements ---
  const els = tab('Elements');
  const tools = h('div', 'position:sticky;top:0;display:flex;flex-wrap:wrap;background:#1e1e1e;border-bottom:1px solid #444');
  const info = h('div');
  const css = h('input', 'display:block;width:100%;box-sizing:border-box;background:#111;color:#fff;border:0;border-bottom:1px solid #444;padding:8px;font:16px ui-monospace,Menlo,monospace;outline:none');
  css.placeholder = 'add css, e.g. color:red';
  css.setAttribute('autocapitalize', 'off');
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
    row(info, path.join(' › '), '#8cf');
    const r = el.getBoundingClientRect();
    row(info, `${Math.round(r.width)} × ${Math.round(r.height)} at (${Math.round(r.left)}, ${Math.round(r.top)})`);
    for (const a of el.attributes) row(info, `${a.name}="${a.value}"`, '#fc6');
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
    const r = row(net, head, '#999');
    const t = performance.now();
    r.done = status => {
      head = `${status || 'ERR'} ${method} ${url}  ${Math.round(performance.now() - t)}ms`;
      r.textContent = clip(head);
      r.style.color = status && status < 400 ? '#ddd' : '#f66';
    };
    r.onclick = () => { open = !open; r.textContent = clip(open ? head + '\n\n' + (r.body ?? '(no body)') : head); };
    return r;
  };
  const ofetch = window.fetch;
  window.fetch = function (input, init) {
    const r = req((init?.method || input?.method || 'GET').toUpperCase(), String(input?.url || input));
    return ofetch.apply(this, arguments).then(res => {
      r.done(res.status);
      res.clone().text().then(b => (r.body = b), () => {});
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
        r.body = this.responseType === '' || this.responseType === 'text' ? this.responseText : `[${this.responseType}]`;
      });
    }
    return xs.apply(this, arguments);
  };

  // --- storage ---
  const st = tab('Storage', 'block', () => {
    st.replaceChildren();
    for (const name of ['localStorage', 'sessionStorage']) {
      row(st, name, '#8cf');
      try {
        const s = window[name];
        for (let i = 0; i < s.length; i++) row(st, s.key(i) + ' = ' + s.getItem(s.key(i)));
      } catch (e) { row(st, String(e), '#f66'); }
    }
    row(st, 'cookies', '#8cf');
    for (const c of document.cookie.split('; ').filter(Boolean)) row(st, c);
  });

  // --- mount ---
  const toggle = () => { host.style.display = host.style.display === 'none' ? '' : 'none'; place(); };
  btn('✕', toggle).style.marginLeft = 'auto';
  window.__unhood = { toggle };
  document.documentElement.append(host);
  show('Console');
  log('Unhood ready. Earlier logs/requests were not captured.', '#999');
})();
