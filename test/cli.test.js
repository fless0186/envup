import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRunner } from '../src/core/runner.js';
import { removeDir, tempDir, writeJson } from './helpers.mjs';

const CLI = fileURLToPath(new URL('../bin/envup.js', import.meta.url));

/**
 * The suite drives the real binary, so argument parsing, exit codes and output
 * formatting are covered end to end. `createRunner` is reused (instead of
 * execFile) because it also copes with environments that forbid pipes.
 */
const runner = createRunner({ timeout: 30_000 });

function runCli(args, cwd) {
  return runner.run(process.execPath, [CLI, ...args], { cwd });
}

test('--version prints the package version', async () => {
  const result = await runCli(['--version'], process.cwd());
  assert.equal(result.ok, true);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('--help documents the commands and exit codes', async () => {
  const result = await runCli(['--help'], process.cwd());
  assert.equal(result.ok, true);
  assert.match(result.stdout, /Usage/);
  assert.match(result.stdout, /check/);
  assert.match(result.stdout, /Exit codes/);
});

test('check exits 0 when the environment satisfies the manifest', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'envup.json'), { name: 'ok', tools: { node: '>=18' } });
    const result = await runCli(['check', dir], dir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /envup check/);
    assert.match(result.stdout, /1 ok/);
  } finally {
    removeDir(dir);
  }
});

test('check exits 1 and prints a fix when a tool is missing', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'envup.json'), {
      name: 'missing',
      tools: { mystery: { bin: 'envup-definitely-not-installed', range: 'any' } },
    });
    const result = await runCli(['check', dir], dir);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /not found on PATH/);
    assert.match(result.stdout, /envup install mystery/);
  } finally {
    removeDir(dir);
  }
});

test('check --json emits parseable output', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'envup.json'), { name: 'json', tools: { node: '>=18' } });
    const result = await runCli(['check', dir, '--json'], dir);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.ok, true);
    assert.equal(payload.tools[0].id, 'node');
  } finally {
    removeDir(dir);
  }
});

test('a missing manifest is a usage error with a hint', async () => {
  const dir = tempDir();
  try {
    const result = await runCli(['check', dir], dir);
    assert.equal(result.code, 2);
    assert.match(result.stdout + result.stderr, /No envup\.json found/);
    assert.match(result.stdout + result.stderr, /envup init/);
  } finally {
    removeDir(dir);
  }
});

test('unknown flags fail fast instead of being ignored', async () => {
  const result = await runCli(['--nope'], process.cwd());
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--nope/);
});

test('init writes a manifest and refuses to clobber one without --force', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'package.json'), { name: 'init-demo', engines: { node: '>=20' } });

    const first = await runCli(['init', dir], dir);
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /created/);

    const second = await runCli(['init', dir], dir);
    assert.equal(second.code, 2);
    assert.match(second.stderr, /already exists/);

    const forced = await runCli(['init', dir, '--force'], dir);
    assert.equal(forced.code, 0);
  } finally {
    removeDir(dir);
  }
});

test('install --dry-run prints commands and changes nothing', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'envup.json'), {
      name: 'dry',
      tools: { mystery: { bin: 'envup-definitely-not-installed', range: 'any' } },
    });
    const result = await runCli(['install', dir, '--dry-run'], dir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /dry run/);
  } finally {
    removeDir(dir);
  }
});

test('install --json emits one parseable document', async () => {
  const dir = tempDir();
  try {
    writeJson(path.join(dir, 'envup.json'), {
      name: 'json-plan',
      tools: { mystery: { bin: 'envup-definitely-not-installed', range: 'any' } },
    });
    const result = await runCli(['install', dir, '--json'], dir);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.name, 'json-plan');
    assert.ok(Array.isArray(payload.plan));
    assert.equal(payload.plan[0].id, 'mystery');
    assert.equal(payload.plan[0].supported, false);
  } finally {
    removeDir(dir);
  }
});
