import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { checkEnvironment, checkExitCode, toJson } from '../src/core/check.js';
import { fakeExecutable, pathString, removeDir, stubRunner, tempDir, writeJson } from './helpers.mjs';

/**
 * A project with a manifest and a fake PATH, so nothing touches the real
 * machine and the result is identical on Windows, macOS and Linux.
 */
function fixture({ tools, versions, executables }) {
  const dir = tempDir();
  const bin = tempDir();
  writeJson(path.join(dir, 'envup.json'), { name: 'fixture', tools });
  for (const name of executables ?? Object.keys(versions)) fakeExecutable(bin, name);

  const context = {
    runner: stubRunner(versions),
    env: { PATH: pathString(bin), PATHEXT: '.EXE;.CMD' },
    platform: 'win32',
  };
  return { dir, bin, context, cleanup: () => [removeDir(dir), removeDir(bin)] };
}

test('checkEnvironment reports ok, missing and unknown', async () => {
  const f = fixture({
    tools: { node: '>=20', python: '>=3.11', go: '>=1.22' },
    versions: { node: 'v24.1.0', python: 'Python 3.13.1' },
    executables: ['node', 'python'],
  });
  try {
    const result = await checkEnvironment({ dir: f.dir, context: f.context });
    const byId = Object.fromEntries(result.results.map((tool) => [tool.id, tool]));
    assert.equal(byId.node.status, 'ok');
    assert.equal(byId.node.found, '24.1.0');
    assert.equal(byId.python.status, 'ok');
    assert.equal(byId.go.status, 'missing');
    assert.equal(result.summary.ok, 2);
    assert.equal(result.summary.missing, 1);
    assert.equal(checkExitCode(result), 1);
  } finally {
    f.cleanup();
  }
});

test('checkEnvironment flags an outdated tool as mismatch', async () => {
  const f = fixture({
    tools: { node: '>=20' },
    versions: { node: 'v18.19.0' },
  });
  try {
    const result = await checkEnvironment({ dir: f.dir, context: f.context });
    assert.equal(result.results[0].status, 'mismatch');
    assert.equal(result.results[0].found, '18.19.0');
    assert.equal(checkExitCode(result), 1);
  } finally {
    f.cleanup();
  }
});

test('an unreadable version is a warning, not a failure', async () => {
  const f = fixture({ tools: { node: '>=20' }, versions: { node: 'no version here' } });
  try {
    const result = await checkEnvironment({ dir: f.dir, context: f.context });
    assert.equal(result.results[0].status, 'unknown');
    assert.equal(checkExitCode(result), 0);
    assert.equal(checkExitCode(result, { strict: true }), 1);
  } finally {
    f.cleanup();
  }
});

test('--only limits the check to the named tools', async () => {
  const f = fixture({
    tools: { node: '>=20', go: '>=1.22' },
    versions: { node: 'v24.1.0' },
  });
  try {
    const result = await checkEnvironment({ dir: f.dir, context: f.context, only: ['node'] });
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].id, 'node');
    assert.equal(checkExitCode(result), 0);
  } finally {
    f.cleanup();
  }
});

test('toJson produces a stable machine-readable shape', async () => {
  const f = fixture({ tools: { node: '>=20' }, versions: { node: 'v24.1.0' } });
  try {
    const result = await checkEnvironment({ dir: f.dir, context: f.context });
    const json = toJson(result);
    assert.equal(json.schemaVersion, 1);
    assert.equal(json.ok, true);
    assert.equal(json.name, 'fixture');
    assert.deepEqual(json.summary, { total: 1, ok: 1, missing: 0, mismatch: 0, unknown: 0 });
    assert.deepEqual(Object.keys(json.tools[0]).sort(), [
      'custom',
      'found',
      'id',
      'path',
      'range',
      'status',
    ]);
  } finally {
    f.cleanup();
  }
});

test('a missing manifest is a clear, actionable error', async () => {
  const dir = tempDir();
  try {
    await assert.rejects(
      checkEnvironment({ dir, context: { runner: stubRunner(), env: {}, platform: 'win32' } }),
      /No envup\.json found/,
    );
  } finally {
    removeDir(dir);
  }
});

test('--only with an undeclared tool is rejected', async () => {
  const f = fixture({ tools: { node: '>=20' }, versions: { node: 'v24.1.0' } });
  try {
    await assert.rejects(
      checkEnvironment({ dir: f.dir, context: f.context, only: ['node', 'ruby'] }),
      /Not declared in envup\.json: ruby/,
    );
  } finally {
    f.cleanup();
  }
});
