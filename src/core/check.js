import { detectTool } from './detect.js';
import { EnvupError } from './errors.js';
import { loadManifest, MANIFEST_FILENAME } from './manifest.js';
import { satisfies } from './semver.js';

/**
 * @typedef {object} ToolResult
 * @property {string} id
 * @property {string} label
 * @property {string} range
 * @property {'ok'|'missing'|'mismatch'|'unknown'} status
 * @property {string|null} found installed version ("21.0.0") or null
 * @property {string|null} path absolute path to the executable
 * @property {boolean} custom
 * @property {import('./registry.js').ToolSpec} spec
 */

/**
 * Compare a manifest against the machine. Pure with respect to the injected
 * runner/which context, which is what makes it testable.
 *
 * @param {{dir: string, context: object, only?: string[]|null}} options
 * @returns {Promise<{manifest: import('./manifest.js').Manifest, results: ToolResult[], summary: {total:number, ok:number, missing:number, mismatch:number, unknown:number}}>}
 */
export async function checkEnvironment(options) {
  const manifest = await loadManifest(options.dir);
  const only = options.only?.length ? new Set(options.only) : null;

  if (only) {
    const declared = new Set(manifest.tools.map((tool) => tool.id));
    const unknown = [...only].filter((id) => !declared.has(id));
    if (unknown.length > 0) {
      throw new EnvupError(`Not declared in ${MANIFEST_FILENAME}: ${unknown.join(', ')}`, {
        code: 'E_ONLY_UNKNOWN',
        hint: `This manifest declares: ${[...declared].join(', ')}`,
      });
    }
  }

  const tools = only ? manifest.tools.filter((tool) => only.has(tool.id)) : manifest.tools;

  /** @type {ToolResult[]} */
  const results = [];

  for (const tool of tools) {
    const probe = await detectTool(tool.spec, options.context);
    /** @type {ToolResult['status']} */
    let status;
    if (probe.status === 'missing') status = 'missing';
    else if (probe.status === 'unknown') status = 'unknown';
    else status = satisfies(probe.version, tool.range) ? 'ok' : 'mismatch';

    results.push({
      id: tool.id,
      label: tool.spec.label,
      range: tool.range,
      status,
      found: probe.version,
      path: probe.path,
      custom: tool.custom,
      spec: tool.spec,
    });
  }

  const summary = { total: results.length, ok: 0, missing: 0, mismatch: 0, unknown: 0 };
  for (const result of results) summary[result.status] += 1;

  return { manifest, results, summary };
}

/** Exit code for a check result: 0 when everything required is satisfied. */
export function checkExitCode(result, { strict = false } = {}) {
  const { summary } = result;
  if (summary.missing > 0 || summary.mismatch > 0) return 1;
  if (strict && summary.unknown > 0) return 1;
  return 0;
}

/** Machine-readable projection used by --json. */
export function toJson(result) {
  return {
    schemaVersion: 1,
    name: result.manifest.name,
    manifest: result.manifest.path,
    ok: result.summary.missing === 0 && result.summary.mismatch === 0,
    summary: result.summary,
    tools: result.results.map((tool) => ({
      id: tool.id,
      range: tool.range,
      status: tool.status,
      found: tool.found,
      path: tool.path,
      custom: tool.custom,
    })),
  };
}
