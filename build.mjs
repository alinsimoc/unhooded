// Encodes unhood.js into a javascript: URL and writes it into index.html.
import { readFileSync, writeFileSync } from 'node:fs';

const bm = 'javascript:' + encodeURIComponent(readFileSync('unhood.js', 'utf8'));
const html = readFileSync('index.html', 'utf8').replace(/const code = .*;/, () => `const code = ${JSON.stringify(bm)};`);
writeFileSync('index.html', html);
console.log(`bookmarklet: ${bm.length} chars`);
