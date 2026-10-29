import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareVersions,
  formatVersion,
  isValidRange,
  normalizeVersion,
  parseRange,
  parseVersion,
  satisfies,
} from '../src/core/semver.js';

test('parseVersion understands full, partial and v-prefixed versions', () => {
  assert.deepEqual(parseVersion('20.11.1'), {
    major: 20,
    minor: 11,
    patch: 1,
    prerelease: '',
  });
  assert.deepEqual(parseVersion('v20.11.1'), {
    major: 20,
    minor: 11,
    patch: 1,
    prerelease: '',
  });
  assert.equal(parseVersion('20').major, 20);
  assert.equal(parseVersion('20.11').minor, 11);
  assert.equal(parseVersion('20.11.1-rc.1').prerelease, 'rc.1');
  assert.equal(parseVersion('not-a-version'), null);
  assert.equal(parseVersion(''), null);
  assert.equal(parseVersion('1.x'), null);
});

test('compareVersions orders releases correctly', () => {
  assert.ok(compareVersions(parseVersion('1.2.3'), parseVersion('1.2.4')) < 0);
  assert.ok(compareVersions(parseVersion('1.10.0'), parseVersion('1.9.9')) > 0);
  assert.equal(compareVersions(parseVersion('1.2.3'), parseVersion('1.2.3')), 0);
  assert.ok(compareVersions(parseVersion('1.2.3'), parseVersion('1.2.3-rc.1')) > 0);
  assert.ok(compareVersions(parseVersion('1.2.3-alpha'), parseVersion('1.2.3-beta')) < 0);
});

test('normalizeVersion extracts the first version-looking token', () => {
  assert.equal(normalizeVersion('v24.22.1'), '24.22.1');
  assert.equal(normalizeVersion('git version 2.45.1.windows.1'), '2.45.1');
  assert.equal(normalizeVersion('openjdk version "21" 2023-09-19'), '21.0.0');
  assert.equal(normalizeVersion('nonsense'), null);
});

test('formatVersion pads partial versions', () => {
  assert.equal(formatVersion(parseVersion('21')), '21.0.0');
});

test('satisfies handles the documented range grammar', () => {
  /** @type {Array<[string, string, boolean]>} */
  const cases = [
    ['20.11.1', '>=20', true],
    ['18.19.0', '>=20', false],
    ['20.11.1', '>20.11.1', false],
    ['20.11.2', '>20.11.1', true],
    ['20.11.1', '<=20.11.1', true],
    ['19.0.0', '<20', true],
    ['20.0.0', '<20', false],
    ['20.11.1', '^20.0.0', true],
    ['21.0.0', '^20.0.0', false],
    ['0.2.5', '^0.2.1', true],
    ['0.3.0', '^0.2.1', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2', true],
    ['1.3.0', '~1.2', false],
    ['1.9.0', '1', true],
    ['2.0.0', '1', false],
    ['1.2.7', '1.2', true],
    ['1.3.0', '1.2', false],
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['1.9.9', '1.x', true],
    ['3.13.17', '>=3.11 <4', true],
    ['4.0.0', '>=3.11 <4', false],
    ['3.9.0', '>=3.11 || >=3.9', true],
    ['3.9.0', '>=3.11', false],
    ['1.2.3', '', true],
    ['1.2.3', '*', true],
    ['1.2.3', 'any', true],
    ['1.2.3', 'ANY', true],
    ['21.0.1', '>=17', true],
    ['1.0.0', '>=1.0.0 <2.0.0', true],
  ];

  for (const [version, range, expected] of cases) {
    assert.equal(satisfies(version, range), expected, `${version} ∊ "${range}"`);
  }
});

test('invalid ranges are rejected instead of silently passing', () => {
  assert.equal(isValidRange('>=20'), true);
  assert.equal(isValidRange('lts/*'), false);
  assert.equal(isValidRange('>=20 ||'), false);
  assert.equal(isValidRange('1.2.3.4.5'), false);
  assert.equal(parseRange('lts/*'), null);
  assert.equal(satisfies('20.0.0', 'lts/*'), false);
});
