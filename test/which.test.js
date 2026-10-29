import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { pathEntries, which, whichAll } from '../src/core/which.js';
import { pathString, removeDir, tempDir } from './helpers.mjs';

test('pathEntries splits, trims and unquotes PATH', () => {
  const env = { PATH: ' "/usr/local/bin" ; /a ;' };
  assert.deepEqual(pathEntries(env, ';'), ['/usr/local/bin', '/a']);
});

test('whichAll finds Windows executables through PATHEXT', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'node.exe'), '');
    const env = { PATH: dir, PATHEXT: '.COM;.EXE;.CMD' };
    assert.deepEqual(whichAll('node', { env, platform: 'win32' }), [path.join(dir, 'node.exe')]);
    assert.deepEqual(whichAll('missing', { env, platform: 'win32' }), []);
  } finally {
    removeDir(dir);
  }
});

test('whichAll matches case-insensitively on Windows', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'Tool.CMD'), '');
    const env = { PATH: dir, PATHEXT: '.EXE;.CMD' };
    assert.deepEqual(whichAll('tool', { env, platform: 'win32' }), [path.join(dir, 'Tool.CMD')]);
  } finally {
    removeDir(dir);
  }
});

test('whichAll respects PATH order', () => {
  const first = tempDir();
  const second = tempDir();
  try {
    fs.writeFileSync(path.join(first, 'node.exe'), '');
    fs.writeFileSync(path.join(second, 'node.exe'), '');
    const env = { PATH: pathString(first, second), PATHEXT: '.EXE' };
    const found = whichAll('node', { env, platform: 'win32' });
    assert.equal(found.length, 2);
    assert.equal(found[0], path.join(first, 'node.exe'));
    assert.equal(which('node', { env, platform: 'win32' }), path.join(first, 'node.exe'));
  } finally {
    removeDir(first);
    removeDir(second);
  }
});

test('whichAll works on POSIX paths', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'rg'), '');
    const env = { PATH: pathString(dir, '/nonexistent-dir') };
    assert.deepEqual(whichAll('rg', { env, platform: 'linux' }), [path.join(dir, 'rg')]);
  } finally {
    removeDir(dir);
  }
});

test('whichAll handles empty and undefined PATH', () => {
  assert.deepEqual(whichAll('node', { env: {}, platform: 'linux' }), []);
  assert.deepEqual(whichAll('', { env: {}, platform: 'linux' }), []);
});
