/**
 * A deliberately small semver implementation.
 *
 * envup does not need npm's full range grammar — it needs to answer one
 * question quickly and predictably: "does this installed version satisfy the
 * constraint the project declared?" The supported subset is documented in
 * README.md ("Version ranges") and in `parseRange()` below.
 */

const PARTIAL_RE =
  /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const COMPARATOR_RE = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/;

/** @typedef {{major:number,minor:number,patch:number,prerelease:string}} Version */

/**
 * Parse a full or partial version string ("20", "20.11", "20.11.1", "v20.11.1").
 * @param {string} input
 * @returns {Version | null}
 */
export function parseVersion(input) {
  if (typeof input !== 'string') return null;
  const match = PARTIAL_RE.exec(input.trim());
  if (!match) return null;
  const parts = [match[1], match[2], match[3]];
  if (parts.some((part) => part !== undefined && /^[xX*]$/.test(part))) return null;
  return {
    major: Number(parts[0]),
    minor: parts[1] === undefined ? 0 : Number(parts[1]),
    patch: parts[2] === undefined ? 0 : Number(parts[2]),
    prerelease: match[4] ?? '',
  };
}

/**
 * Compare two parsed versions.
 * @returns {number} negative, zero, or positive
 */
export function compareVersions(a, b) {
  for (const key of /** @type {const} */ (['major', 'minor', 'patch'])) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  const preA = a.prerelease ?? '';
  const preB = b.prerelease ?? '';
  if (preA === preB) return 0;
  // A release outranks any prerelease of the same version.
  if (!preA) return 1;
  if (!preB) return -1;
  return comparePrerelease(preA, preB);
}

function comparePrerelease(a, b) {
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** Render a version the way users expect to see it ("21.0.0"). */
export function formatVersion(version) {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease ? `${base}-${version.prerelease}` : base;
}

/**
 * Normalize an arbitrary version-ish string to "x.y.z" (best effort).
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeVersion(input) {
  if (typeof input !== 'string') return null;
  const match = /\d+(?:\.\d+){0,2}/.exec(input);
  if (!match) return null;
  const parsed = parseVersion(match[0]);
  return parsed ? formatVersion(parsed) : null;
}

function parsePartial(text) {
  const match = PARTIAL_RE.exec(text.trim());
  if (!match) return null;
  const raw = [match[1], match[2], match[3]];
  const values = raw.map((part) =>
    part === undefined || /^[xX*]$/.test(part) ? null : Number(part),
  );
  const wildcardFrom = values.findIndex((value) => value === null);  return {
    major: values[0],
    minor: values[1],
    patch: values[2],
    prerelease: match[4] ?? '',
    wildcardFrom,
  };
}

function toVersion(partial) {
  return {
    major: partial.major ?? 0,
    minor: partial.minor ?? 0,
    patch: partial.patch ?? 0,
    prerelease: partial.prerelease,
  };
}

/**
 * Turn one token ("^1.2", ">=3.11", "1.x") into primitive comparators.
 * @returns {Array<{op:string, version:Version}> | null}
 */
function expandOne(op, partial) {
  const always = [];

  if (partial.wildcardFrom === 0) {
    // "*", "x", ">=*" — anything goes.
    return always;
  }

  const base = toVersion(partial);

  if (op === '^') {
    let upper;
    if (base.major > 0) {
      upper = { major: base.major + 1, minor: 0, patch: 0, prerelease: '' };
    } else if (base.minor > 0) {
      upper = { major: 0, minor: base.minor + 1, patch: 0, prerelease: '' };
    } else {
      upper = { major: 0, minor: 0, patch: base.patch + 1, prerelease: '' };
    }
    return [
      { op: '>=', version: base },
      { op: '<', version: upper },
    ];
  }

  if (op === '~') {
    const upper =
      partial.minor === null
        ? { major: base.major + 1, minor: 0, patch: 0, prerelease: '' }
        : { major: base.major, minor: base.minor + 1, patch: 0, prerelease: '' };
    return [
      { op: '>=', version: base },
      { op: '<', version: upper },
    ];
  }

  if (op === '=' || op === undefined) {
    // wildcardFrom === -1 means every component was given: an exact version.
    if (partial.wildcardFrom === -1) {
      return [{ op: '=', version: base }];
    }
    // "1.2" / "1.2.x" behave like "~1.2"; "1" behaves like "~1".
    const upper =
      partial.minor === null
        ? { major: base.major + 1, minor: 0, patch: 0, prerelease: '' }
        : { major: base.major, minor: base.minor + 1, patch: 0, prerelease: '' };
    return [
      { op: '>=', version: base },
      { op: '<', version: upper },
    ];
  }

  return [{ op, version: base }];
}

function test(version, comparator) {
  const delta = compareVersions(version, comparator.version);
  switch (comparator.op) {
    case '>=':
      return delta >= 0;
    case '<=':
      return delta <= 0;
    case '>':
      return delta > 0;
    case '<':
      return delta < 0;
    case '=':
      return delta === 0;
    default:
      return false;
  }
}

/**
 * Parse a range expression into alternatives of comparators.
 * Supported: "*" | "any" | "" , exact, partial, ^, ~, >=, <=, >, <, "||".
 * @returns {{always:boolean, alternatives:Array<Array<{op:string,version:Version}>>} | null}
 */
export function parseRange(range) {
  if (range === undefined || range === null) return { always: true, alternatives: [] };
  const text = String(range).trim();
  if (!text || text === '*' || /^any$/i.test(text)) {
    return { always: true, alternatives: [] };
  }

  const alternatives = [];
  for (const chunk of text.split('||')) {
    const trimmed = chunk.trim();
    if (!trimmed) return null;
    const comparators = [];
    for (const token of trimmed.split(/\s+/)) {
      const match = COMPARATOR_RE.exec(token);
      if (!match) return null;
      const partial = parsePartial(match[2]);
      if (!partial) return null;
      const expanded = expandOne(match[1], partial);
      if (expanded === null) return null;
      comparators.push(...expanded);
    }
    alternatives.push(comparators);
  }

  return { always: false, alternatives };
}

/** True when `range` is syntactically valid. */
export function isValidRange(range) {
  return parseRange(range) !== null;
}

/**
 * Does `version` satisfy `range`?
 * @param {string} version
 * @param {string} range
 */
export function satisfies(version, range) {
  const parsedVersion = parseVersion(version);
  const spec = parseRange(range);
  if (!parsedVersion || !spec) return false;
  if (spec.always) return true;
  return spec.alternatives.some((set) => set.every((c) => test(parsedVersion, c)));
}
