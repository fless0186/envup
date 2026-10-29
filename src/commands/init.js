import fs from 'node:fs/promises';

import { EnvupError } from '../core/errors.js';
import { manifestPath, writeManifest } from '../core/manifest.js';
import { scanProject } from '../core/project.js';
import { INDENT, padEnd } from '../core/style.js';

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * `envup init` — detect the toolchain and write envup.json.
 * @returns {Promise<number>} exit code
 */
export async function initCommand(ctx) {
  const { style, options } = ctx;
  const file = manifestPath(ctx.cwd);

  if ((await exists(file)) && !options.force) {
    throw new EnvupError(`${file} already exists.`, {
      code: 'E_MANIFEST_EXISTS',
      hint: 'Pass --force to regenerate it, or edit it by hand.',
    });
  }

  const scan = await scanProject(ctx.cwd);

  if (scan.tools.length === 0) {
    throw new EnvupError('Could not detect any toolchain in this directory.', {
      code: 'E_NOTHING_DETECTED',
      hint:
        'envup looks for package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, Gemfile, ' +
        'composer.json, Dockerfile, .tool-versions, .nvmrc and lockfiles. ' +
        'Write envup.json by hand if your project uses something else.',
    });
  }

  const tools = Object.fromEntries(scan.tools.map((tool) => [tool.id, tool.range]));
  await writeManifest(ctx.cwd, { name: scan.name, tools });

  if (options.json) {
    ctx.write(
      `${JSON.stringify({ file, name: scan.name, tools: scan.tools }, null, 2)}\n`,
    );
    return 0;
  }

  const idWidth = Math.max(6, ...scan.tools.map((tool) => tool.id.length));
  const rangeWidth = Math.max(6, ...scan.tools.map((tool) => tool.range.length));

  ctx.out();
  ctx.out(`${INDENT}${style.bold('envup init')} ${style.dim('·')} ${scan.name}`);
  ctx.out();
  for (const tool of scan.tools) {
    ctx.out(
      `${INDENT}${style.green(style.symbols.ok)}  ${padEnd(tool.id, idWidth)}  ` +
        `${padEnd(tool.range, rangeWidth)}  ${style.dim(tool.source)}`,
    );
  }
  ctx.out();
  for (const note of scan.notes) ctx.out(`${INDENT}${style.yellow(style.symbols.warn)}  ${note}`);
  ctx.out(`${INDENT}${style.dim('created')} ${file}`);
  ctx.out(`${INDENT}${style.dim('next')}  envup check`);
  return 0;
}
