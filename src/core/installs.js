/**
 * Turning "this tool is missing" into "run this exact command".
 *
 * All of it is pure data → command translation, so the planner is fully
 * testable and `envup install --dry-run` can never surprise anyone.
 */

/** Build the install command for one manager. */
const LAUNCHERS = {
  winget: (id) => ({
    file: 'winget',
    args: [
      'install',
      '--id',
      id,
      '-e',
      '--source',
      'winget',
      '--accept-source-agreements',
      '--accept-package-agreements',
    ],
  }),
  scoop: (id) => ({ file: 'scoop', args: ['install', id] }),
  choco: (id) => ({ file: 'choco', args: ['install', '-y', id] }),
  brew: (id) => ({ file: 'brew', args: ['install', ...id.split(/\s+/)] }),
  apt: (id) => ({ file: 'apt-get', args: ['install', '-y', id], sudo: true }),
  dnf: (id) => ({ file: 'dnf', args: ['install', '-y', id], sudo: true }),
  pacman: (id) => ({ file: 'pacman', args: ['-S', '--noconfirm', id], sudo: true }),
  zypper: (id) => ({ file: 'zypper', args: ['install', '-y', id], sudo: true }),
  apk: (id) => ({ file: 'apk', args: ['add', id], sudo: true }),
  npm: (id) => ({ file: 'npm', args: ['install', '-g', id] }),
};

/** Quote a token for display only — execution never goes through a shell. */
function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9._:/@+=-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

/** Render a command for humans. */
export function formatCommand(command) {
  return [command.file, ...command.args.map(shellQuote)].join(' ');
}

/**
 * @typedef {object} InstallPlan
 * @property {boolean} supported
 * @property {string} toolId
 * @property {string} manager
 * @property {string} packageId
 * @property {{file:string,args:string[],sudo?:boolean}} command
 * @property {string} display
 * @property {boolean} requiresSudo
 * @property {string} [reason]
 * @property {string} [hint]
 */

/**
 * Decide how to install one tool on this machine.
 *
 * @param {import('./registry.js').ToolSpec} tool
 * @param {{managers: string[], platform?: NodeJS.Platform, privileged?: boolean}} context
 * @returns {InstallPlan}
 */
export function planInstall(tool, context) {
  const managers = context.managers ?? [];
  const privileged = context.privileged ?? false;

  // A tool may prefer one manager over the platform default: pnpm/yarn are far
  // more reliable from npm than from an OS package index.
  const ordered = [...(tool.prefer ?? []), ...managers];
  /** @type {string[]} */
  const available = [];
  for (const manager of ordered) {
    if (available.includes(manager)) continue;
    if (!managers.includes(manager)) continue;
    if (!tool.install || !tool.install[manager]) continue;
    available.push(manager);
  }

  if (available.length === 0) {
    const known = Object.keys(tool.install ?? {});
    return {
      supported: false,
      toolId: tool.id,
      manager: '',
      packageId: '',
      command: { file: '', args: [] },
      display: '',
      requiresSudo: false,
      reason: known.length
        ? `no package manager for this tool is available here (needs one of: ${known.join(', ')})`
        : 'envup has no installer for this tool',
      hint: tool.homepage ? `Install it manually: ${tool.homepage}` : 'Install it manually, then run "envup check" again.',
    };
  }

  const manager = available[0];
  const packageId = tool.install[manager];
  const launcher = LAUNCHERS[manager];
  const base = launcher(packageId);
  const requiresSudo = Boolean(base.sudo) && !privileged;
  const command = requiresSudo
    ? { file: 'sudo', args: [base.file, ...base.args], sudo: true }
    : { file: base.file, args: base.args };

  return {
    supported: true,
    toolId: tool.id,
    manager,
    packageId,
    command,
    display: formatCommand(command),
    requiresSudo,
    hint: requiresSudo ? 'This needs sudo. Re-run with --sudo to allow it.' : '',
  };
}
