import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { scanProject } from '../src/core/project.js';
import { removeDir, tempDir, write, writeJson } from './helpers.mjs';

test('scanProject reads engines, packageManager and lockfiles', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'package.json'), {
      name: 'demo-app',
      packageManager: 'pnpm@9.12.0',
      engines: { node: '>=20' },
    });
    write(path.join(dir, 'pnpm-lock.yaml'));
    write(path.join(dir, '.git', 'HEAD'));

    const scan = await scanProject(dir);
    assert.equal(scan.name, 'demo-app');
    const byId = Object.fromEntries(scan.tools.map((tool) => [tool.id, tool]));
    assert.equal(byId.node.range, '>=20');
    assert.match(byId.node.source, /engines\.node/);
    assert.equal(byId.pnpm.range, '>=9.12.0');
    assert.ok(byId.git, 'a .git directory implies git');
  } finally {
    removeDir(dir);
  }
});

test('scanProject falls back to .nvmrc when engines is absent', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'package.json'), { name: 'no-engines' });
    write(path.join(dir, '.nvmrc'), 'v20.11.1\n');

    const scan = await scanProject(dir);
    const node = scan.tools.find((tool) => tool.id === 'node');
    assert.equal(node.range, '>=20.11.1');
    assert.equal(node.source, '.nvmrc');
  } finally {
    removeDir(dir);
  }
});

test('scanProject detects python from pyproject.toml', async () => {
  const dir = tempDir();
  try {
    write(path.join(dir, 'pyproject.toml'), '[project]\nrequires-python = ">=3.11"\n');
    const scan = await scanProject(dir);
    assert.equal(scan.tools.length, 1);
    assert.equal(scan.tools[0].id, 'python');
    assert.equal(scan.tools[0].range, '>=3.11');
  } finally {
    removeDir(dir);
  }
});

test('scanProject detects go, docker and rust', async () => {
  const dir = tempDir();
  try {
    write(path.join(dir, 'go.mod'), 'module demo\n\ngo 1.22\n');
    write(path.join(dir, 'Dockerfile'), 'FROM scratch\n');
    write(path.join(dir, 'Cargo.toml'), '[package]\nname = "demo"\n');

    const scan = await scanProject(dir);
    const ids = scan.tools.map((tool) => tool.id);
    assert.ok(ids.includes('go'));
    assert.ok(ids.includes('docker'));
    assert.ok(ids.includes('rustc'));
    assert.equal(scan.tools.find((tool) => tool.id === 'go').range, '>=1.22');
  } finally {
    removeDir(dir);
  }
});

test('scanProject understands .tool-versions', async () => {
  const dir = tempDir();
  try {
    write(path.join(dir, '.tool-versions'), 'nodejs 20.11.1\npython 3.12.2\n');
    const scan = await scanProject(dir);
    const byId = Object.fromEntries(scan.tools.map((tool) => [tool.id, tool]));
    assert.equal(byId.node.range, '>=20.11.1');
    assert.equal(byId.python.range, '>=3.12.2');
  } finally {
    removeDir(dir);
  }
});

test('scanProject returns an empty tool list for an unknown project', async () => {
  const dir = tempDir();
  try {
    write(path.join(dir, 'README.md'), '# nothing here\n');
    const scan = await scanProject(dir);
    assert.deepEqual(scan.tools, []);
  } finally {
    removeDir(dir);
  }
});

test('scanProject survives a broken package.json and a BOM', async () => {
  const dir = tempDir();
  try {
    write(path.join(dir, 'package.json'), '\uFEFF{ "name": "broken" ');
    const scan = await scanProject(dir);
    assert.ok(scan.notes.some((note) => /could not be parsed/.test(note)));
    assert.equal(scan.tools.find((tool) => tool.id === 'node').range, '>=20');
  } finally {
    removeDir(dir);
  }
});

test('scanProject prefers an explicit engines range over a lockfile default', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'package.json'), { engines: { node: '>=18.17' } });
    write(path.join(dir, 'package-lock.json'), '{}');
    const scan = await scanProject(dir);
    const byId = Object.fromEntries(scan.tools.map((tool) => [tool.id, tool]));
    assert.equal(byId.node.range, '>=18.17');
    assert.equal(byId.npm.range, 'any');
  } finally {
    removeDir(dir);
  }
});
