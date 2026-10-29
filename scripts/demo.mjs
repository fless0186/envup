#!/usr/bin/env node
/**
 * Build a throwaway project, run `envup init` and `envup check` against it, and
 * delete it again. Handy for screenshots and for seeing the output on your own
 * machine without touching a real repository.
 *
 *   npm run demo
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRunner } from '../src/core/runner.js';

const cli = fileURLToPath(new URL('../bin/envup.js', import.meta.url));
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'envup-demo-'));
const runner = createRunner();

const write = async (name, content) => {
  await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
  await fs.writeFile(path.join(dir, name), content);
};

try {
  await write(
    'package.json',
    `${JSON.stringify(
      {
        name: 'acme-web',
        version: '1.4.0',
        private: true,
        packageManager: 'pnpm@9.12.0',
        engines: { node: '>=20' },
      },
      null,
      2,
    )}\n`,
  );
  await write(
    'pyproject.toml',
    '[project]\nname = "acme-data"\nrequires-python = ">=3.11"\n',
  );
  await write('go.mod', 'module github.com/acme/tools\n\ngo 1.22\n');
  await write('Dockerfile', 'FROM node:20-slim\n');
  await write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  await write('.git/HEAD', 'ref: refs/heads/main\n');

  console.log(`  demo project: ${dir}`);
  await runner.runInteractive(process.execPath, [cli, 'init', dir]);
  await runner.runInteractive(process.execPath, [cli, 'check', dir]);
  await runner.runInteractive(process.execPath, [cli, 'install', dir, '--dry-run']);
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
