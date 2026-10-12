// Dev server: serves this folder on :3000, rebuilds the bookmarklet when unhooded.js or build.mjs
// changes, and live-reloads open pages, reopening the Unhooded panel if it was open.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { execFile } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain' };
const clients = new Set();

// Injected into served HTML: reload on change; remember an open panel and reopen it after the reload.
const client = `<script>
if (sessionStorage.uhOpen) { sessionStorage.removeItem('uhOpen'); addEventListener('load', () => document.getElementById('try')?.click()); }
new EventSource('/__reload').onmessage = () => {
  if (document.body.classList.contains('inspecting')) sessionStorage.uhOpen = 1;
  location.reload();
};
</script>`;

http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (path.split('/').some(p => p.startsWith('.'))) return res.writeHead(404).end(); // no .git, .claude
  const file = join('.', normalize(path === '/' ? '/index.html' : path));
  try {
    let body = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    if (type === 'text/html') body = body.toString().replace(/<\/body>|$/, m => client + m);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error('Port 3000 is already in use. Another dev server is probably running; stop it first.');
  process.exit(1);
}).listen(3000, () => console.log('Unhooded dev server: http://localhost:3000'));

// File events arrive in bursts (editors save in several steps), so act once things settle.
const debounce = fn => { let t; return () => { clearTimeout(t); t = setTimeout(fn, 150); }; };
const reload = debounce(() => { for (const c of clients) c.write('data: reload\n\n'); });
const build = debounce(() => execFile('node', ['build.mjs'], (err, out, errOut) => console.log(err ? errOut : out.trim())));

watch('.', { recursive: true }, (_, name) => {
  if (!name || name.startsWith('.')) return;
  // A rebuild rewrites index.html, and that change triggers the reload, so the page reloads once.
  if (name === 'unhooded.js' || name === 'build.mjs') build();
  else reload();
});
build();
