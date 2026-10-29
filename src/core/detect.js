import { normalizeVersion } from './semver.js';
import { whichAll } from './which.js';

/**
 * Pull a version number out of command output.
 * @param {string} raw
 * @param {RegExp} pattern
 * @returns {string | null} normalized "x.y.z"
 */
export function extractVersion(raw, pattern) {
  if (!raw) return null;
  pattern.lastIndex = 0;
  const match = pattern.exec(String(raw));
  if (!match) return null;
  return normalizeVersion(match[1] ?? match[0]);
}

/** Windows ships "app execution aliases" that are 0-byte stubs opening the Store. */
function isStoreAlias(file, env) {
  const root = env.LOCALAPPDATA ?? '';
  if (!root) return false;
  return file.toLowerCase().startsWith(`${root}\\microsoft\\windowsapps`.toLowerCase());
}

/**
 * @typedef {object} ToolProbe
 * @property {'ok'|'missing'|'unknown'} status
 * @property {string|null} path
 * @property {string|null} version
 * @property {string} bin   the executable name that was used
 * @property {string} raw   raw output used for version detection
 * @property {string[]} candidates every path found for this tool
 */

/**
 * Locate a tool and read its version.
 *
 * @param {import('./registry.js').ToolSpec} tool
 * @param {{runner: {run: Function}, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform}} context
 * @returns {Promise<ToolProbe>}
 */
export async function detectTool(tool, context) {
  const env = context.env ?? process.env;
  const platform = context.platform ?? process.platform;
  const runner = context.runner;

  /** @type {Array<{bin: string, path: string}>} */
  const candidates = [];
  const seen = new Set();
  for (const bin of tool.bins) {
    for (const file of whichAll(bin, { env, platform, cache: context.cache })) {
      const key = platform === 'win32' ? file.toLowerCase() : file;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ bin, path: file });
    }
  }

  if (candidates.length === 0) {
    return { status: 'missing', path: null, version: null, bin: tool.bins[0], raw: '', candidates: [] };
  }

  /** @type {ToolProbe} */
  const result = {
    status: 'unknown',
    path: candidates[0].path,
    version: null,
    bin: candidates[0].bin,
    raw: '',
    candidates: candidates.map((candidate) => candidate.path),
  };

  for (const candidate of candidates) {
    const run = await runner.run(candidate.path, tool.versionArgs, { timeout: 8000 });
    const raw = run.output ?? `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const version = extractVersion(raw, tool.versionPattern);
    if (version) {
      return {
        status: 'ok',
        path: candidate.path,
        version,
        bin: candidate.bin,
        raw,
        candidates: result.candidates,
      };
    }
    if (!result.raw && raw) result.raw = raw;
  }

  // A Store alias reports nothing at all — it is not a real installation.
  if (platform === 'win32' && isStoreAlias(result.path, env)) {
    return { ...result, status: 'missing', version: null };
  }

  return result;
}
