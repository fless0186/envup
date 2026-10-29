import fs from 'node:fs/promises';
import path from 'node:path';

import { toolIds } from './registry.js';
import { isValidRange } from './semver.js';

/**
 * Project introspection for `envup init`.
 *
 * The goal is not to be exhaustive — it is to produce a manifest that is right
 * for the repository in front of you, and to tell you where each requirement
 * came from so you can correct it in one line.
 */

/** @typedef {{id:string, range:string, source:string, priority:number}} Signal */

const LOCKFILES = [
  { file: 'package-lock.json', tool: 'npm' },
  { file: 'pnpm-lock.yaml', tool: 'pnpm' },
  { file: 'yarn.lock', tool: 'yarn' },
  { file: 'bun.lockb', tool: 'bun' },
  { file: 'bun.lock', tool: 'bun' },
  { file: 'poetry.lock', tool: 'poetry' },
  { file: 'uv.lock', tool: 'uv' },
  { file: 'Cargo.lock', tool: 'cargo' },
  { file: 'go.sum', tool: 'go' },
  { file: 'Gemfile.lock', tool: 'ruby' },
  { file: 'composer.lock', tool: 'php' },
];

/**
 * Inspect a directory and propose a tool map.
 *
 * @param {string} dir
 * @returns {Promise<{name:string, tools:Array<{id:string, range:string, source:string}>, notes:string[]}>}
 */
export async function scanProject(dir) {
  /** @type {Signal[]} */
  const signals = [];
  const notes = [];

  const add = (id, range, source, priority) => {
    signals.push({ id, range: normalizeRange(range, notes), source, priority });
  };

  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read ${dir}: ${error.message}`);
  }

  const files = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  const dirs = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  const has = (name) => files.has(name);

  const readText = async (name) => {
    try {
      // A UTF-8 BOM is common on Windows and breaks JSON.parse / range parsing.
      return (await fs.readFile(path.join(dir, name), 'utf8')).replace(/^\uFEFF/, '');
    } catch {
      return null;
    }
  };
  const readJson = async (name) => {
    const text = await readText(name);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      notes.push(`${name} could not be parsed as JSON and was ignored.`);
      return null;
    }
  };

  /* ---------------------------------------------------------------- Node.js */
  if (has('package.json')) {
    const pkg = (await readJson('package.json')) ?? {};
    let range = '>=20';
    let source = 'package.json (default Node LTS range)';

    if (typeof pkg.engines?.node === 'string' && pkg.engines.node.trim()) {
      range = pkg.engines.node.trim();
      source = 'package.json engines.node';
    } else {
      const nvmrc = ((await readText('.nvmrc')) ?? '').trim().replace(/^v/, '');
      const nodeVersion = ((await readText('.node-version')) ?? '').trim().replace(/^v/, '');
      const pinned = nvmrc || nodeVersion;
      if (pinned) {
        range = `>=${pinned}`;
        source = nvmrc ? '.nvmrc' : '.node-version';
      }
    }
    add('node', range, source, 10);

    if (typeof pkg.packageManager === 'string') {
      const match = /^([a-z]+)@(\d+(?:\.\d+){0,2})/.exec(pkg.packageManager.trim());
      if (match && ['npm', 'pnpm', 'yarn', 'bun'].includes(match[1])) {
        add(match[1], `>=${match[2]}`, 'package.json packageManager', 12);
      }
    }

    for (const [engine, id] of [
      ['npm', 'npm'],
      ['pnpm', 'pnpm'],
      ['yarn', 'yarn'],
    ]) {
      const value = pkg.engines?.[engine];
      if (typeof value === 'string' && value.trim()) {
        add(id, value, `package.json engines.${engine}`, 11);
      }
    }
  }

  for (const lock of LOCKFILES) {
    if (has(lock.file)) add(lock.tool, 'any', lock.file, 6);
  }

  /* ------------------------------------------------------------------ Python */
  if (has('pyproject.toml')) {
    const text = (await readText('pyproject.toml')) ?? '';
    const match = /requires-python\s*=\s*["']([^"']+)["']/.exec(text);
    if (match) add('python', match[1], 'pyproject.toml requires-python', 10);
    else add('python', '>=3.10', 'pyproject.toml', 5);
  }

  if (has('.python-version')) {
    const pinned = ((await readText('.python-version')) ?? '').trim().split(/\s+/)[0];
    if (pinned && /^\d/.test(pinned)) add('python', `>=${pinned}`, '.python-version', 11);
  }

  if (has('requirements.txt') || has('setup.py') || has('Pipfile')) {
    add('python', '>=3.10', 'requirements.txt / setup.py', 4);
  }

  /* ---------------------------------------------------------------------- Go */
  if (has('go.mod')) {
    const match = /^go\s+(\d+\.\d+(?:\.\d+)?)/m.exec((await readText('go.mod')) ?? '');
    add('go', match ? `>=${match[1]}` : 'any', 'go.mod', 10);
  }

  /* -------------------------------------------------------------------- Rust */
  if (has('Cargo.toml')) {
    let range = 'any';
    let source = 'Cargo.toml';
    if (has('rust-toolchain.toml') || has('rust-toolchain')) {
      const text =
        (await readText('rust-toolchain.toml')) ?? (await readText('rust-toolchain')) ?? '';
      const match = /channel\s*=\s*["']([^"']+)["']|^([0-9]+\.[0-9]+(?:\.[0-9]+)?)$/m.exec(text);
      const channel = match?.[1] ?? match?.[2];
      if (channel && /^\d/.test(channel)) {
        range = `>=${channel}`;
        source = 'rust-toolchain';
      }
    }
    add('rustc', range, source, 9);
    add('cargo', range, source, 9);
  }

  /* -------------------------------------------------------------------- Java */
  if (has('pom.xml')) {
    const text = (await readText('pom.xml')) ?? '';
    const match =
      /<maven\.compiler\.(?:release|source)>\s*(\d+)\s*</.exec(text) ??
      /<java\.version>\s*(\d+)\s*</.exec(text);
    add('java', match ? `>=${match[1]}` : '>=17', 'pom.xml', 9);
  }
  if (has('build.gradle') || has('build.gradle.kts')) {
    const text =
      (await readText('build.gradle')) ?? (await readText('build.gradle.kts')) ?? '';
    const match = /(?:sourceCompatibility|languageVersion)\s*[=\s]\s*(?:JavaVersion\.VERSION_)?(\d+)/.exec(
      text,
    );
    add('java', match ? `>=${match[1]}` : '>=17', 'build.gradle', 9);
  }

  /* ------------------------------------------------------------------- .NET */
  if (has('global.json')) {
    const json = await readJson('global.json');
    const version = json?.sdk?.version;
    if (typeof version === 'string' && version) {
      add('dotnet', `>=${version.split('.').slice(0, 2).join('.')}`, 'global.json sdk.version', 10);
    }
  }
  if ([...files].some((file) => file.endsWith('.csproj') || file.endsWith('.fsproj'))) {
    add('dotnet', '>=8', '*.csproj', 6);
  }

  /* ---------------------------------------------------------- Ruby / PHP */
  if (has('Gemfile')) add('ruby', '>=3.1', 'Gemfile', 7);
  if (has('composer.json')) {
    const json = await readJson('composer.json');
    const phpRange = json?.require?.php;
    add('php', typeof phpRange === 'string' ? phpRange : '>=8.1', 'composer.json', 8);
  }

  /* ----------------------------------------------------------------- Docker */
  if (
    has('Dockerfile') ||
    has('docker-compose.yml') ||
    has('docker-compose.yaml') ||
    has('compose.yml') ||
    has('compose.yaml')
  ) {
    add('docker', '>=24', 'Dockerfile / compose file', 6);
  }

  /* -------------------------------------------------------------------- Git */
  if (dirs.has('.git')) add('git', '>=2.30', '.git', 3);

  /* ---------------------------------------------------------------- asdf */
  if (has('.tool-versions')) {
    const text = (await readText('.tool-versions')) ?? '';
    const aliases = { nodejs: 'node', python: 'python', golang: 'go', rust: 'rustc', java: 'java' };
    for (const line of text.split(/\r?\n/)) {
      const [name, version] = line.trim().split(/\s+/);
      const id = aliases[name] ?? name;
      if (!name || !version || version === 'system') continue;
      add(id, `>=${version}`, '.tool-versions', 8);
    }
  }

  /* -------------------------------------------------------------- assemble */
  /** @type {Map<string, Signal>} */
  const best = new Map();
  for (const signal of signals) {
    const current = best.get(signal.id);
    if (!current || signal.priority > current.priority) best.set(signal.id, signal);
  }

  const registryOrder = toolIds();
  const tools = [...best.values()].sort((a, b) => {
    const ai = registryOrder.indexOf(a.id);
    const bi = registryOrder.indexOf(b.id);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return a.id.localeCompare(b.id);
  });

  let name = path.basename(path.resolve(dir));
  if (has('package.json')) {
    const pkg = await readJson('package.json');
    if (typeof pkg?.name === 'string' && pkg.name) name = pkg.name;
  }

  return {
    name,
    tools: tools.map(({ id, range, source }) => ({ id, range, source })),
    notes,
  };
}

/**
 * Keep ranges the semver parser understands; anything else (`lts/*`, `system`)
 * becomes "any" with a note, so `init` never writes a manifest that cannot be
 * validated.
 */
function normalizeRange(range, notes) {
  const text = String(range ?? '').trim();
  if (!text) return 'any';
  if (isValidRange(text)) return text;
  notes.push(`Ignored unsupported version range "${text}" — requiring any version instead.`);
  return 'any';
}
