import assert from 'node:assert/strict';
import test from 'node:test';

import { createStyle, padEnd, shouldUseColor, truncate } from '../src/core/style.js';

test('padEnd ignores ANSI escapes when measuring width', () => {
  const style = createStyle({ color: true });
  const painted = style.red('abc');
  assert.equal(padEnd(painted, 5).endsWith('  '), true);
  assert.equal(padEnd('abcdef', 3), 'abcdef');
});

test('truncate keeps output within the requested width', () => {
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abc', 4), 'abc');
});

test('colour is disabled when asked', () => {
  const style = createStyle({ color: false });
  assert.equal(style.red('x'), 'x');
  assert.equal(style.dim('x'), 'x');
});

test('ASCII mode swaps the status glyphs', () => {
  const style = createStyle({ color: false, ascii: true });
  assert.deepEqual(style.symbols, { ok: '+', bad: 'x', warn: '!', info: '-' });
  const unicode = createStyle({ color: false });
  assert.deepEqual(unicode.symbols, { ok: '✓', bad: '✗', warn: '!', info: '·' });
});

test('mark() colours by status', () => {
  const style = createStyle({ color: false });
  assert.equal(style.mark('ok'), style.symbols.ok);
  assert.equal(style.mark('missing'), style.symbols.bad);
  assert.equal(style.mark('unknown'), style.symbols.warn);
});

test('shouldUseColor respects NO_COLOR and FORCE_COLOR', () => {
  assert.equal(shouldUseColor({ env: { NO_COLOR: '1' }, isTTY: true }), false);
  assert.equal(shouldUseColor({ env: { FORCE_COLOR: '1' }, isTTY: false }), true);
  assert.equal(shouldUseColor({ env: {}, isTTY: false }), false);
  assert.equal(shouldUseColor({ env: {}, isTTY: true }), true);
});
