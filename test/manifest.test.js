import assert from 'node:assert/strict';
import test from 'node:test';

import { parseManifest } from '../src/core/manifest.js';

test('parseManifest reads the string shorthand', () => {
  const manifest = parseManifest(
    JSON.stringify({ name: 'demo', tools: { node: '>=20', python: '>=3.11' } }),
  );
  assert.equal(manifest.name, 'demo');
  assert.equal(manifest.tools.length, 2);
  assert.equal(manifest.tools[0].id, 'node');
  assert.equal(manifest.tools[0].range, '>=20');
  assert.equal(manifest.tools[0].custom, false);
  assert.deepEqual(manifest.tools[0].spec.bins, ['node']);
});

test('parseManifest accepts the object form and per-tool overrides', () => {
  const manifest = parseManifest(
    JSON.stringify({ tools: { node: { range: '>=18', bin: 'nodejs' } } }),
  );
  assert.equal(manifest.tools[0].range, '>=18');
  assert.deepEqual(manifest.tools[0].spec.bins, ['nodejs']);
});

test('parseManifest builds custom tools from a bin', () => {
  const manifest = parseManifest(
    JSON.stringify({
      tools: { ripgrep: { bin: 'rg', range: '>=13', versionPattern: '(\\d+\\.\\d+\\.\\d+)' } },
    }),
  );
  const [tool] = manifest.tools;
  assert.equal(tool.id, 'ripgrep');
  assert.equal(tool.custom, true);
  assert.deepEqual(tool.spec.bins, ['rg']);
  assert.ok(tool.spec.versionPattern instanceof RegExp);
});

test('parseManifest resolves aliases to canonical ids', () => {
  const manifest = parseManifest(JSON.stringify({ tools: { golang: '>=1.22', nodejs: '>=20' } }));
  assert.deepEqual(
    manifest.tools.map((tool) => tool.id),
    ['go', 'node'],
  );
});

test('parseManifest tolerates a UTF-8 BOM', () => {
  const text = `\uFEFF${JSON.stringify({ tools: { node: '>=20' } })}`;
  assert.equal(parseManifest(text).tools[0].range, '>=20');
});

test('parseManifest rejects malformed manifests with actionable errors', () => {
  assert.throws(() => parseManifest('{'), /not valid JSON/);
  assert.throws(() => parseManifest('[]'), /must contain a JSON object/);
  assert.throws(() => parseManifest('{}'), /missing a "tools" object/);
  assert.throws(() => parseManifest('{"tools":{}}'), /declares no tools/);
  assert.throws(() => parseManifest('{"tools":{"node":123}}'), /must be a version range/);
  assert.throws(() => parseManifest('{"tools":{"node":"lts/*"}}'), /invalid version range/);
  assert.throws(
    () => parseManifest('{"tools":{"who-knows":"1"}}'),
    /Unknown tool "who-knows"/,
  );
});

test('parseManifest normalizes missing ranges to "any"', () => {
  const manifest = parseManifest(JSON.stringify({ tools: { node: {} } }));
  assert.equal(manifest.tools[0].range, 'any');
});
