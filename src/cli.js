import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { checkCommand } from './commands/check.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { addCommand, removeCommand } from './commands/manifest-edit.js';
import { EnvupError } from './core/errors.js';
import { createRunner } from './core/runner.js';
import { createStyle, shouldUseColor } from './core/style.js';

const COMMANDS = new Map([
  ['check', checkCommand],
  ['install', installCommand],
  ['init', initCommand],
  ['doctor', doctorCommand],
  ['add', addCommand],
  ['remove', removeCommand],
]);

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  json: { type: 'boolean' },
  quiet: { type: 'boolean', short: 'q' },
  verbose: { type: 'boolean' },
  strict: { type: 'boolean' },
  force: { type: 'boolean', short: 'f' },
  'dry-run': { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  sudo: { type: 'boolean' },
  'keep-going': { type: 'boolean' },
  only: { type: 'string' },
  'no-color': { type: 'boolean' },
  ascii: { type: 'boolean' },
};

/** Read the version from package.json so the CLI and the package never drift. */
async function readVersion() {
  const text = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
  return JSON.parse(text).version;
}

function helpText(version) {
  return `
  envup ${version} — one manifest, one command

  Usage
    envup [command] [options] [dir]

  Commands
    check      verify the project's toolchain (default)
    install    install everything check reports as missing
    init       detect tools from the project and write envup.json
    doctor     diagnose PATH, shadowed binaries and package managers
    add        add a tool to envup.json
    remove     remove a tool from envup.json

  Options
    --json             machine-readable output
    --only <ids>       limit to these tools (comma separated)
    --strict           treat warnings as failures
    --quiet, -q        one-line summary
    --verbose          print resolved executable paths
    --dry-run          print install commands without running them
    --yes, -y          skip the confirmation prompt
    --sudo             allow the sudo commands install needs on Linux
    --keep-going       keep installing after a failure
    --force, -f        overwrite an existing envup.json (init)
    --no-color         disable ANSI colour
    --ascii            ASCII status symbols
    -h, --help
    -v, --version

  Examples
    envup init
    envup check --verbose
    envup install --dry-run
    envup install --yes
    envup add node@">=20" pnpm

  Exit codes
    0  everything satisfied        1  problems found        2  usage or config error
`;
}

/**
 * Entry point. Returns the process exit code instead of calling process.exit
 * so tests can assert on it and streams are flushed properly.
 *
 * @param {{argv?: string[], cwd?: string, env?: NodeJS.ProcessEnv}} [input]
 * @returns {Promise<number>}
 */
export async function main(input = {}) {
  const argv = input.argv ?? process.argv.slice(2);
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const platform = process.platform;

  let values;
  let positionals;
  try {
    const parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (error) {
    process.stderr.write(`  ${error.message}\n  Run "envup --help" for usage.\n`);
    return 2;
  }

  const version = await readVersion();

  if (values.help) {
    process.stdout.write(`${helpText(version)}\n`);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  const first = positionals[0];
  const commandName = first && COMMANDS.has(first) ? first : 'check';
  const rest = first && COMMANDS.has(first) ? positionals.slice(1) : positionals;
  const command = COMMANDS.get(commandName);

  // add/remove take tool names, everything else takes an optional project dir.
  const takesDir = commandName !== 'add' && commandName !== 'remove';
  const dirArg = takesDir ? (rest[0] ?? '.') : '.';
  const args = takesDir ? [] : rest;

  const ascii = Boolean(values.ascii) || env.ENVUP_ASCII === '1';
  const color = values['no-color'] ? false : shouldUseColor({ env });
  const style = createStyle({ color, ascii });

  let dir;
  try {
    dir = path.resolve(cwd, dirArg);
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new EnvupError(`Not a directory: ${dir}`, { code: 'E_USAGE' });
    }
  } catch (error) {
    const message = error instanceof EnvupError ? error.message : 'Cannot open directory: ' + dir;
    process.stderr.write(`  ${style.error(`${style.symbols.bad} ${message}`)}\n`);
    process.stderr.write(`    ${style.dim('Pass a path to the project root, for example "envup check ./apps/web".')}\n`);
    return 2;
  }

  const options = {
    json: Boolean(values.json),
    quiet: Boolean(values.quiet),
    verbose: Boolean(values.verbose),
    strict: Boolean(values.strict),
    force: Boolean(values.force),
    dryRun: Boolean(values['dry-run']),
    yes: Boolean(values.yes),
    sudo: Boolean(values.sudo),
    keepGoing: Boolean(values['keep-going']),
    only: values.only
      ? String(values.only)
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : null,
    args,
  };

  const runner = createRunner({ env, platform });

  const ctx = {
    cwd: dir,
    env,
    platform,
    runner,
    style,
    options,
    context: { runner, env, platform, cache: new Map() },
    interactive: Boolean(process.stdin.isTTY) && !options.json,
    out: (line = '') => process.stdout.write(`${line}\n`),
    err: (line = '') => process.stderr.write(`${line}\n`),
    write: (text) => process.stdout.write(text),
  };

  try {
    return await command(ctx);
  } catch (error) {
    if (error instanceof EnvupError) {
      ctx.err(`  ${style.error(`${style.symbols.bad} ${error.message}`)}`);
      if (error.hint) {
        for (const line of error.hint.split('\n')) ctx.err(`    ${style.dim(line)}`);
      }
      return 2;
    }
    ctx.err(`  ${style.error(`${style.symbols.bad} ${error.message}`)}`);
    if (options.verbose && error.stack) ctx.err(style.dim(error.stack));
    return 2;
  }
}
