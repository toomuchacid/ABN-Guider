import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = path.join(root, 'wrangler.toml');
const pagesPath = path.join(root, 'wrangler.pages.toml');
const backupPath = path.join(root, '.wrangler', 'wrangler.toml.backup');

function isPagesConfig(text) {
  return /^pages_build_output_dir\s*=/m.test(text);
}

/**
 * `wrangler pages dev` only reads wrangler.toml, and that file is the Worker
 * config Cloudflare deploys. Swap in the Pages config for the duration of fn.
 */
export async function withPagesConfig(fn) {
  const original = await readFile(tomlPath, 'utf8');
  const pages = await readFile(pagesPath, 'utf8');
  await mkdir(path.dirname(backupPath), { recursive: true });
  if (!isPagesConfig(original)) await writeFile(backupPath, original);
  await writeFile(tomlPath, pages);
  try {
    return await fn();
  } finally {
    const restore = isPagesConfig(original)
      ? await readFile(backupPath, 'utf8').catch(() => original)
      : original;
    await writeFile(tomlPath, restore);
  }
}
