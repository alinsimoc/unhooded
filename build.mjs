// Encodes unhooded.js into a javascript: URL and writes it into index.html.
// On Netlify (URL env is set) the bookmarklet first tries the live unhooded.js,
// falling back to the embedded copy when the page's CSP blocks external scripts.
import { readFileSync, writeFileSync } from 'node:fs';

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

const bm = 'javascript:' + encodeURIComponent(code);
const size = `${Math.round(bm.length / 1000)} KB`;
const html = readFileSync('index.html', 'utf8')
  .replace(/const code = .*;/, () => `const code = ${JSON.stringify(bm)};`)
  .replace(/(<span id="size">)[^<]*/, (_, tag) => tag + size);
writeFileSync('index.html', html);
console.log(`bookmarklet: ${bm.length} chars (${size})${live ? ` (live: ${live})` : ''}`);
