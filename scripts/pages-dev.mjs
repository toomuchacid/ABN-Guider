import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPagesConfig } from './pages-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8788';

let code = 0;
await withPagesConfig(() => new Promise((resolve) => {
  const child = spawn(
    'npx',
    ['wrangler', 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', port],
    { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } },
  );
  const stop = () => child.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (exitCode) => {
    code = exitCode ?? 0;
    resolve();
  });
}));
process.exit(code);
