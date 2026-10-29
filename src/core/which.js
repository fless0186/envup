import fs from 'node:fs';
import path from 'node:path';

/**
 * PATH lookup without shelling out to `which` / `where`.
 *
 * On Windows the lookup is done by listing each PATH directory once and
 * matching names case-insensitively. That is both faster than one stat per
 * candidate and more accurate: Windows app-execution aliases (the `winget.exe`
 * and `python.exe` stubs in `…\Microsoft\WindowsApps`) are reparse points that
 * `statSync` refuses with EACCES even though the shell can run them.
 */

/**
 * Split PATH into clean directory entries, stripping stray quotes.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [delimiter]
 * @returns {string[]}
 */
export function pathEntries(env = process.env, delimiter = path.delimiter) {
  const raw = env.PATH ?? env.Path ?? env.path ?? '';
  return raw
    .split(delimiter)
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

/** Directory listing cache, scoped to one lookup pass by the caller. */
function listingFor(dir, cache) {
  if (cache.has(dir)) return cache.get(dir);
  let index;
  try {
    index = new Map();
    for (const name of fs.readdirSync(dir)) index.set(name.toLowerCase(), name);
  } catch {
    index = null; // unreadable directory: fall back to per-file stat
  }
  cache.set(dir, index);
  return index;
}

/**
 * Actual file name for `relative` inside `directory`, or null when absent.
 * Returning the on-disk spelling matters on case-sensitive filesystems mounted
 * next to Windows (WSL) and makes the reported paths faithful.
 */
function actualName(directory, relative, listing) {
  if (listing) return listing.get(relative.toLowerCase()) ?? null;
  try {
    return fs.statSync(path.join(directory, relative)).isFile() ? relative : null;
  } catch {
    return null;
  }
}

/**
 * Find every executable named `bin` on PATH, in PATH order.
 *
 * @param {string} bin
 * @param {{env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, cache?: Map<string, Set<string>|null>}} [options]
 * @returns {string[]}
 */
export function whichAll(bin, options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  if (!bin) return [];

  const cache = options.cache ?? new Map();
  const dirs = pathEntries(env);
  const hasExtension = /\.[A-Za-z0-9]+$/.test(bin);
  const extensions = hasExtension
    ? ['']
    : (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
        .split(';')
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean)
        .concat(['']);

  const found = [];
  const seen = new Set();

  for (const dir of dirs) {
    const listing = platform === 'win32' ? listingFor(dir, cache) : null;
    for (const extension of extensions) {
      const relative = `${bin}${extension}`;
      const actual = actualName(dir, relative, listing);
      if (!actual) continue;
      const full = path.join(dir, actual);
      const key = platform === 'win32' ? full.toLowerCase() : full;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(full);
    }
  }

  return found;
}

/**
 * Find the first executable named `bin` on PATH.
 * @returns {string | null}
 */
export function which(bin, options) {
  return whichAll(bin, options)[0] ?? null;
}
