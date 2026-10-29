import fs from 'node:fs/promises';
import path from 'node:path';

import { EnvupError } from './errors.js';
import { canonicalId, customTool, getTool, toolIds } from './registry.js';
import { isValidRange } from './semver.js';

export const MANIFEST_FILENAME = 'envup.json';
export const MANIFEST_SCHEMA_URL =
  'https://raw.githubusercontent.com/fless0186/envup/main/envup.schema.json';

/**
 * @typedef {object} ManifestTool
 * @property {string} id      canonical id (or the raw id for custom tools)
 * @property {import('./registry.js').ToolSpec} spec
 * @property {string} range   version constraint ("any" when unconstrained)
 * @property {boolean} custom true when the tool is defined inline in the manifest
 */

/**
 * @typedef {object} Manifest
 * @property {string} path
 * @property {string} dir
 * @property {string} name
 * @property {ManifestTool[]} tools
 * @property {Record<string, unknown>} raw
 */

/** Path to the manifest in `dir`, whether or not it exists. */
export function manifestPath(dir) {
  return path.join(dir, MANIFEST_FILENAME);
}

/**
 * Parse and validate manifest JSON. Pure — no filesystem access — so the
 * validation rules can be unit tested without fixtures.
 *
 * @param {string} text
 * @param {{file?: string}} [options]
 * @returns {Manifest}
 */
export function parseManifest(text, options = {}) {
  const file = options.file ?? MANIFEST_FILENAME;
  let raw;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new EnvupError(`${file} is not valid JSON: ${error.message}`, {
      code: 'E_MANIFEST_JSON',
      hint: `Fix the syntax, or run "envup init --force" to regenerate the file.`,
    });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new EnvupError(`${file} must contain a JSON object.`, { code: 'E_MANIFEST_SHAPE' });
  }

  const toolsRaw = raw.tools;
  if (!toolsRaw || typeof toolsRaw !== 'object' || Array.isArray(toolsRaw)) {
    throw new EnvupError(`${file} is missing a "tools" object.`, {
      code: 'E_MANIFEST_SHAPE',
      hint: 'Example: { "tools": { "node": ">=20", "python": ">=3.11" } }',
    });
  }

  const entries = Object.entries(toolsRaw);
  if (entries.length === 0) {
    throw new EnvupError(`${file} declares no tools.`, {
      code: 'E_MANIFEST_EMPTY',
      hint: 'Add at least one entry to "tools".',
    });
  }

  /** @type {ManifestTool[]} */
  const tools = [];
  for (const [name, value] of entries) {
    tools.push(parseToolEntry(name, value, file));
  }

  return {
    path: path.resolve(file),
    dir: path.dirname(path.resolve(file)),
    // Filled in by loadManifest, which knows the real directory.
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '',
    tools,
    raw,
  };
}

/**
 * @param {string} name
 * @param {unknown} value
 * @param {string} file
 * @returns {ManifestTool}
 */
function parseToolEntry(name, value, file) {
  /** @type {Record<string, unknown>} */
  let options = {};
  let range = 'any';

  if (typeof value === 'string') {
    range = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    options = /** @type {Record<string, unknown>} */ (value);
    if (options.range !== undefined) {
      if (typeof options.range !== 'string') {
        throw new EnvupError(`tools.${name}.range must be a string in ${file}.`, {
          code: 'E_MANIFEST_RANGE',
        });
      }
      range = options.range;
    } else if (typeof options.version === 'string') {
      range = options.version;
    }
  } else {
    throw new EnvupError(`tools.${name} must be a version range string or an object in ${file}.`, {
      code: 'E_MANIFEST_TOOL',
      hint: 'Example: "node": ">=20"  or  "node": { "range": ">=20" }',
    });
  }

  if (!isValidRange(range)) {
    throw new EnvupError(`tools.${name} has an invalid version range "${range}" in ${file}.`, {
      code: 'E_MANIFEST_RANGE',
      hint: 'Use >=, >, <=, <, ^, ~, an exact version, "||", or "any".',
    });
  }

  const canonical = canonicalId(name);
  const known = canonical ? getTool(canonical) : null;

  if (!known) {
    if (!options.bin) {
      throw new EnvupError(`Unknown tool "${name}" in ${file}.`, {
        code: 'E_MANIFEST_TOOL',
        hint:
          `Known tools: ${toolIds().join(', ')}.\n` +
          `For anything else add a "bin": { "${name}": { "bin": "${name}", "range": ">=1" } }`,
      });
    }
    return {
      id: String(name),
      spec: customTool(String(name), {
        bin: /** @type {string|string[]} */ (options.bin),
        versionArgs: Array.isArray(options.versionArgs)
          ? /** @type {string[]} */ (options.versionArgs)
          : undefined,
        versionPattern:
          typeof options.versionPattern === 'string' ? options.versionPattern : undefined,
        range,
      }),
      range,
      custom: true,
    };
  }

  const spec = { ...known };
  if (options.bin) {
    spec.bins = Array.isArray(options.bin)
      ? /** @type {string[]} */ (options.bin)
      : [/** @type {string} */ (options.bin)];
  }
  if (Array.isArray(options.versionArgs)) spec.versionArgs = /** @type {string[]} */ (options.versionArgs);
  if (typeof options.versionPattern === 'string') {
    spec.versionPattern = new RegExp(options.versionPattern);
  }

  return { id: known.id, spec, range, custom: false };
}

/**
 * Read and validate `envup.json` from `dir`.
 * @param {string} dir
 * @returns {Promise<Manifest>}
 */
export async function loadManifest(dir) {
  const file = manifestPath(dir);
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new EnvupError(`No ${MANIFEST_FILENAME} found in ${path.resolve(dir)}`, {
        code: 'E_NO_MANIFEST',
        hint: `Run "envup init" to create one from the files in this project.`,
      });
    }
    throw error;
  }

  const manifest = parseManifest(text, { file });
  manifest.path = file;
  manifest.dir = path.resolve(dir);
  if (!manifest.name) manifest.name = path.basename(manifest.dir);
  return manifest;
}

/**
 * Write a manifest, keeping a stable key order and 2-space indentation.
 * @param {string} dir
 * @param {{name?: string, tools: Record<string, string>}} data
 */
export async function writeManifest(dir, data) {
  const payload = {
    $schema: MANIFEST_SCHEMA_URL,
    name: data.name,
    tools: data.tools,
  };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const file = manifestPath(dir);
  await fs.writeFile(file, text, 'utf8');
  return file;
}
