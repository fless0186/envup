import os from 'node:os';

import { which } from './which.js';

/**
 * Package managers envup can drive, in the order it prefers them per platform.
 * `npm` is last everywhere: it is the right answer for JS tools, a poor one for
 * everything else.
 */
export const MANAGER_ORDER = {
  win32: ['winget', 'scoop', 'choco', 'npm'],
  darwin: ['brew', 'npm'],
  linux: ['apt', 'dnf', 'pacman', 'zypper', 'apk', 'npm'],
};

/** Executable + version flag for each manager. */
export const MANAGERS = {
  winget: { cmd: 'winget', versionArgs: ['--version'] },
  scoop: { cmd: 'scoop', versionArgs: ['--version'] },
  choco: { cmd: 'choco', versionArgs: ['--version'] },
  brew: { cmd: 'brew', versionArgs: ['--version'] },
  apt: { cmd: 'apt-get', versionArgs: ['--version'] },
  dnf: { cmd: 'dnf', versionArgs: ['--version'] },
  pacman: { cmd: 'pacman', versionArgs: ['--version'] },
  zypper: { cmd: 'zypper', versionArgs: ['--version'] },
  apk: { cmd: 'apk', versionArgs: ['--version'] },
  npm: { cmd: 'npm', versionArgs: ['--version'] },
};

/**
 * Detect which package managers are usable.
 *
 * @param {{runner: {run: Function}, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform}} context
 * @returns {Promise<Array<{id:string, cmd:string, version:string|null}>>}
 */
export async function detectManagers(context) {
  const platform = context.platform ?? process.platform;
  const env = context.env ?? process.env;
  const order = MANAGER_ORDER[platform] ?? MANAGER_ORDER.linux;
  const found = [];

  for (const id of order) {
    const entry = MANAGERS[id];
    if (!entry) continue;
    const file = which(entry.cmd, { env, platform });
    if (!file) continue;
    const run = await context.runner.run(file, entry.versionArgs, { timeout: 5000 });
    const text = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const match = /\d+\.\d+(?:\.\d+)?/.exec(text);
    found.push({ id, cmd: file, version: match ? match[0] : null });
  }

  return found;
}

/**
 * A short, human-readable description of the machine.
 */
export function describeSystem(env = process.env) {
  const platform = process.platform;
  const release = os.release();
  let name = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[platform] ?? platform;

  if (platform === 'linux' && env.WSL_DISTRO_NAME) {
    name = `WSL (${env.WSL_DISTRO_NAME})`;
  }

  return {
    platform,
    name,
    release,
    arch: process.arch,
    node: process.versions.node,
    shell: env.SHELL || env.ComSpec || 'unknown',
    home: os.homedir(),
    wsl: Boolean(env.WSL_DISTRO_NAME),
  };
}

/** True when the current process already has root/administrator rights. */
export function isPrivileged() {
  if (process.platform === 'win32') return true; // no sudo concept for installers
  try {
    return typeof process.getuid === 'function' && process.getuid() === 0;
  } catch {
    return false;
  }
}
