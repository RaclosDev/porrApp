import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const files = process.argv.slice(2);
if (!files.length) process.exit(0);
const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    resolve(frontend, 'node_modules/eslint/bin/eslint.js'),
    '--report-unused-disable-directives',
    '--max-warnings',
    '0',
    ...files.map((file) => resolve(file)),
  ],
  { cwd: frontend, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
