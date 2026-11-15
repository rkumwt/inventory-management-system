// Copies every .env.example to .env (root and apps/*) unless .env already
// exists, so a fresh clone is runnable without hand-editing files.
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = join(root, 'apps');

const dirs = [root];
if (existsSync(appsDir)) {
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) dirs.push(join(appsDir, entry.name));
  }
}

for (const dir of dirs) {
  const example = join(dir, '.env.example');
  const target = join(dir, '.env');
  if (!existsSync(example)) continue;
  if (existsSync(target)) {
    console.log(`skip    ${target} (already exists)`);
    continue;
  }
  copyFileSync(example, target);
  console.log(`created ${target}`);
}
