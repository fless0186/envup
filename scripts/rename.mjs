#!/usr/bin/env node
/**
 * Replace the `OWNER/envup` placeholders that ship with this template.
 *
 *   node scripts/rename.mjs your-github-name
 *   node scripts/rename.mjs your-github-name my-repo
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [, , ownerArg, repoArg = 'envup'] = process.argv;

if (!ownerArg) {
  console.error('usage: node scripts/rename.mjs <github-owner> [repo-name]');
  process.exit(2);
}

const owner = ownerArg.replace(/^@/, '');
if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repoArg)) {
  console.error('owner and repo may only contain letters, digits, dot, dash and underscore');
  process.exit(2);
}

const targets = [
  'package.json',
  'README.md',
  'README.zh-CN.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'envup.schema.json',
  'src/core/manifest.js',
  '.github/ISSUE_TEMPLATE/config.yml',
];

let changed = 0;
for (const relative of targets) {
  const file = path.join(root, relative);
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    continue;
  }
  const next = text
    .replaceAll('OWNER/envup', `${owner}/${repoArg}`)
    .replaceAll('github.com/OWNER', `github.com/${owner}`);
  if (next !== text) {
    await fs.writeFile(file, next, 'utf8');
    changed += 1;
    console.log(`  updated ${relative}`);
  }
}

console.log(
  changed === 0
    ? '  nothing to do — placeholders already replaced'
    : `\n  done. ${changed} file(s) updated for ${owner}/${repoArg}`,
);
