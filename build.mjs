// Encodes unhooded.js into a javascript: URL and writes it into index.html.
// On Netlify (URL env is set) the bookmarklet first tries the live unhooded.js,
// falling back to the embedded copy when the page's CSP blocks external scripts.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const src = readFileSync('unhooded.js', 'utf8');
const live = process.env.URL && `${process.env.URL}/unhooded.js`;
const code = live
  ? `(() => {
  if (window.__unhooded) return window.__unhooded.toggle();
  const embedded = () => {
${src}
    console.info('Unhooded: this page blocks loading the latest version, so the copy saved in your bookmark is running.');
  };
  try {
    const s = document.createElement('script');
    s.src = ${JSON.stringify(live)} + '?' + Date.now();
    s.onerror = () => { s.remove(); embedded(); };
    document.documentElement.append(s);
  } catch { embedded(); } // Trusted Types throws on s.src
})();`
  : src;

// Minify via a pinned terser run through npx, so no node_modules lands in the published folder.
// negate_iife=false keeps `(()=>{…})()` instead of `!function(){}()`.
const min = execFileSync('npx', ['--yes', 'terser@5.36.0', '--compress', 'negate_iife=false', '--mangle', '--format', 'quote_style=1'], { input: code, encoding: 'utf8' }).trim();
// `void 0` last: a javascript: URL that evaluates to a value replaces the page with it.
// Escape only what a javascript: URL needs: % (decoded before running), # (fragment), " (keeps the
// index.html marker simple), < > (inline <script>), and anything outside printable ASCII — newlines,
// tabs, non-ASCII (the u flag keeps emoji whole). Spaces and the rest of the code stay readable.
const bm = 'javascript:' + `${min};void 0`.replace(/[%#"<>]|[^ -~]/gu, encodeURIComponent);
const size = `${Math.round(bm.length / 1000)}\u00a0KB`; // non-breaking space keeps "18 KB" on one line
// Patterns tolerate formatters (line breaks, missing semicolons); the encoded code never contains a raw quote.
const markers = [
  [/const code =\s*"[^"]*";?/, () => `const code = ${JSON.stringify(bm)};`],
  [/(<span id="size">)[^<]*/, (_, tag) => tag + size],
];
let html = readFileSync('index.html', 'utf8');
for (const [re, fn] of markers) {
  if (!re.test(html)) throw new Error(`index.html: marker ${re} not found`);
  html = html.replace(re, fn);
}
writeFileSync('index.html', html);
console.log(`bookmarklet: ${bm.length} chars (${size})${live ? ` (live: ${live})` : ''}`);
