import fs from 'node:fs/promises';

import { EnvupError } from '../core/errors.js';
import { loadManifest } from '../core/manifest.js';
import { getTool, toolIds } from '../core/registry.js';
import { isValidRange } from '../core/semver.js';
import { INDENT } from '../core/style.js';

/**
 * Split "node@>=20" into ["node", ">=20"].
 * Scoped package names never appear here, so a plain first-@ split is safe.
 */
export function parseToolArg(argument) {
  const text = String(argument).trim();
  const at = text.indexOf('@', 1);
  if (at === -1) return { name: text, range: '' };
  return { name: text.slice(0, at), range: text.slice(at + 1) };
}

async function save(manifest, tools) {
  const payload = { ...manifest.raw, tools };
  await fs.writeFile(manifest.path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * `envup add node@>=20 python` — edit the manifest instead of hand-editing JSON.
 */
export async function addCommand(ctx) {
  const { style, options } = ctx;
  const manifest = await loadManifest(ctx.cwd);
  const tools = { ...manifest.raw.tools };

  if (options.args.length === 0) {
    throw new EnvupError('Nothing to add.', {
      code: 'E_USAGE',
      hint: 'Example: envup add node@">=20" python@">=3.11"',
    });
  }

  const added = [];
  for (const argument of options.args) {
    const { name, range } = parseToolArg(argument);
    const canonical = getTool(name);
    if (!canonical) {
      throw new EnvupError(`Unknown tool "${name}".`, {
        code: 'E_UNKNOWN_TOOL',
        hint: `Known tools: ${toolIds().join(', ')}. Custom tools must be added to envup.json by hand.`,
      });
    }
    const effective = range || canonical.defaultRange;
    if (!isValidRange(effective)) {
      throw new EnvupError(`Invalid version range "${effective}" for ${canonical.id}.`, {
        code: 'E_MANIFEST_RANGE',
      });
    }
    tools[canonical.id] = effective;
    added.push({ id: canonical.id, range: effective });
  }

  await save(manifest, tools);

  if (options.json) {
    ctx.write(`${JSON.stringify({ manifest: manifest.path, added, tools }, null, 2)}\n`);
    return 0;
  }

  ctx.out();
  for (const entry of added) {
    ctx.out(`${INDENT}${style.green(style.symbols.ok)} ${entry.id} ${style.dim(entry.range)}`);
  }
  ctx.out(`${INDENT}${style.dim('updated')} ${manifest.path}`);
  ctx.out(`${INDENT}${style.dim('next')}  envup check`);
  return 0;
}

/** `envup remove <tool>...` */
export async function removeCommand(ctx) {
  const { style, options } = ctx;
  const manifest = await loadManifest(ctx.cwd);
  const tools = { ...manifest.raw.tools };

  if (options.args.length === 0) {
    throw new EnvupError('Nothing to remove.', { code: 'E_USAGE', hint: 'Example: envup remove docker' });
  }

  const removed = [];
  for (const argument of options.args) {
    const { name } = parseToolArg(argument);
    const canonical = getTool(name);
    const key = canonical?.id ?? String(name);
    if (!(key in tools)) {
      throw new EnvupError(`"${key}" is not declared in ${manifest.path}.`, { code: 'E_NOT_IN_MANIFEST' });
    }
    delete tools[key];
    removed.push(key);
  }

  await save(manifest, tools);

  if (options.json) {
    ctx.write(`${JSON.stringify({ manifest: manifest.path, removed, tools }, null, 2)}\n`);
    return 0;
  }

  ctx.out();
  for (const id of removed) ctx.out(`${INDENT}${style.red(style.symbols.bad)} ${id}`);
  ctx.out(`${INDENT}${style.dim('updated')} ${manifest.path}`);
  return 0;
}
