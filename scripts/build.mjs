import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { headersFile } from '../src/lib/security-headers.js';
import { allPages } from '../src/pages/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

await mkdir(path.join(dist, 'assets'), { recursive: true });
await mkdir(path.join(dist, 'feedback'), { recursive: true });

for (const page of allPages()) {
  const file = path.join(dist, page.file);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page.html);
}

await esbuild.build({
  entryPoints: {
    'name-check': path.join(root, 'src/client/name-check.js'),
    guide: path.join(root, 'src/client/guide.js'),
    report: path.join(root, 'src/client/report.js'),
    unlock: path.join(root, 'src/client/unlock.js'),
    feedback: path.join(root, 'src/client/feedback.js'),
  },
  bundle: true,
  format: 'esm',
  outdir: path.join(dist, 'assets'),
  target: 'es2022',
  minify: true,
  legalComments: 'none',
});

await copyFile(path.join(root, 'src/styles/site.css'), path.join(dist, 'assets/site.css'));
await copyFile(path.join(root, 'src/static/favicon.svg'), path.join(dist, 'favicon.svg'));
await writeFile(path.join(dist, '_headers'), headersFile());
await writeFile(path.join(dist, 'robots.txt'), [
  'User-agent: *',
  'Allow: /',
  'Disallow: /report',
  'Disallow: /unlock/return',
  'Disallow: /api/',
  '',
].join('\n'));

console.log(`Built ${allPages().length} pages into dist/`);
