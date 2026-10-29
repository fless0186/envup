/**
 * The tool registry.
 *
 * Everything envup knows about a tool lives here: how to find it, how to read
 * its version out of stdout/stderr, and which package id to ask each platform
 * package manager for. Keeping this as plain data means adding a tool is a
 * one-object change and never touches the check/install logic.
 *
 * `install` values are package identifiers:
 *   winget  -> winget package id
 *   scoop   -> scoop package name
 *   choco   -> chocolatey package name
 *   brew    -> homebrew formula (may include flags, e.g. "--cask docker")
 *   apt/dnf/pacman/apk -> distro package name
 *   npm     -> global npm package name
 */

/**
 * @typedef {object} ToolSpec
 * @property {string} id
 * @property {string} label
 * @property {string[]} bins
 * @property {string[]} versionArgs
 * @property {RegExp} versionPattern
 * @property {string} defaultRange
 * @property {Record<string,string>} install
 * @property {string[]} [prefer] managers to try first
 * @property {string} [homepage]
 * @property {string} [note]
 */

/** @type {ToolSpec[]} */
export const TOOLS = [
  {
    id: 'node',
    label: 'Node.js',
    bins: ['node'],
    versionArgs: ['--version'],
    versionPattern: /v?(\d+\.\d+\.\d+)/,
    defaultRange: '>=20',
    homepage: 'https://nodejs.org',
    install: {
      winget: 'OpenJS.NodeJS.LTS',
      scoop: 'nodejs-lts',
      choco: 'nodejs-lts',
      brew: 'node',
      apt: 'nodejs',
      dnf: 'nodejs',
      pacman: 'nodejs',
      apk: 'nodejs',
    },
  },
  {
    id: 'npm',
    label: 'npm',
    bins: ['npm'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=10',
    homepage: 'https://docs.npmjs.com',
    note: 'installed together with Node.js',
    install: {},
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    bins: ['pnpm'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=9',
    homepage: 'https://pnpm.io',
    prefer: ['npm'],
    install: {
      winget: 'pnpm.pnpm',
      scoop: 'pnpm',
      choco: 'pnpm',
      brew: 'pnpm',
      npm: 'pnpm',
    },
  },
  {
    id: 'yarn',
    label: 'Yarn',
    bins: ['yarn'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=1',
    homepage: 'https://yarnpkg.com',
    prefer: ['npm'],
    install: {
      winget: 'Yarn.Yarn',
      scoop: 'yarn',
      choco: 'yarn',
      brew: 'yarn',
      npm: 'yarn',
    },
  },
  {
    id: 'bun',
    label: 'Bun',
    bins: ['bun'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=1',
    homepage: 'https://bun.sh',
    install: {
      winget: 'oven-sh.bun',
      scoop: 'bun',
      brew: 'oven-sh/bun/bun',
      npm: 'bun',
    },
  },
  {
    id: 'deno',
    label: 'Deno',
    bins: ['deno'],
    versionArgs: ['--version'],
    versionPattern: /deno\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=1',
    homepage: 'https://deno.com',
    install: {
      winget: 'DenoLand.Deno',
      scoop: 'deno',
      brew: 'deno',
    },
  },
  {
    id: 'python',
    label: 'Python',
    bins: ['python3', 'python', 'py'],
    versionArgs: ['--version'],
    versionPattern: /Python\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=3.10',
    homepage: 'https://www.python.org',
    install: {
      winget: 'Python.Python.3.12',
      scoop: 'python',
      choco: 'python',
      brew: 'python@3.12',
      apt: 'python3',
      dnf: 'python3',
      pacman: 'python',
      apk: 'python3',
    },
  },
  {
    id: 'pip',
    label: 'pip',
    bins: ['pip3', 'pip'],
    versionArgs: ['--version'],
    versionPattern: /pip\s+(\d+\.\d+(?:\.\d+)?)/,
    defaultRange: '>=23',
    homepage: 'https://pip.pypa.io',
    note: 'installed together with Python',
    install: {
      apt: 'python3-pip',
      dnf: 'python3-pip',
    },
  },
  {
    id: 'uv',
    label: 'uv',
    bins: ['uv'],
    versionArgs: ['--version'],
    versionPattern: /uv\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=0.4',
    homepage: 'https://docs.astral.sh/uv',
    install: {
      winget: 'astral-sh.uv',
      scoop: 'uv',
      brew: 'uv',
    },
  },
  {
    id: 'poetry',
    label: 'Poetry',
    bins: ['poetry'],
    versionArgs: ['--version'],
    versionPattern: /version\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=1.8',
    homepage: 'https://python-poetry.org',
    install: {
      scoop: 'poetry',
      brew: 'poetry',
    },
  },
  {
    id: 'go',
    label: 'Go',
    bins: ['go'],
    versionArgs: ['version'],
    versionPattern: /go(\d+\.\d+(?:\.\d+)?)/,
    defaultRange: '>=1.22',
    homepage: 'https://go.dev',
    install: {
      winget: 'GoLang.Go',
      scoop: 'go',
      choco: 'golang',
      brew: 'go',
      apt: 'golang-go',
      dnf: 'golang',
      pacman: 'go',
      apk: 'go',
    },
  },
  {
    id: 'rustc',
    label: 'Rust (rustc)',
    bins: ['rustc'],
    versionArgs: ['--version'],
    versionPattern: /rustc\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=1.75',
    homepage: 'https://www.rust-lang.org',
    install: {
      winget: 'Rustlang.Rustup',
      scoop: 'rustup',
      choco: 'rust-ms',
      brew: 'rustup',
      apt: 'rustc',
      dnf: 'rust',
      pacman: 'rust',
      apk: 'rust',
    },
  },
  {
    id: 'cargo',
    label: 'Cargo',
    bins: ['cargo'],
    versionArgs: ['--version'],
    versionPattern: /cargo\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=1.75',
    homepage: 'https://doc.rust-lang.org/cargo',
    note: 'installed together with Rust',
    install: {
      winget: 'Rustlang.Rustup',
      scoop: 'rustup',
      brew: 'rustup',
      apt: 'cargo',
      dnf: 'cargo',
      pacman: 'rust',
      apk: 'cargo',
    },
  },
  {
    id: 'java',
    label: 'Java',
    bins: ['java'],
    versionArgs: ['-version'],
    versionPattern: /version\s+"?(\d+)(?:\.(\d+))?/,
    defaultRange: '>=17',
    homepage: 'https://adoptium.net',
    install: {
      winget: 'EclipseAdoptium.Temurin.21.JDK',
      scoop: 'temurin21-jdk',
      choco: 'temurin21',
      brew: 'openjdk@21',
      apt: 'default-jdk',
      dnf: 'java-21-openjdk',
      pacman: 'jdk-openjdk',
      apk: 'openjdk21',
    },
  },
  {
    id: 'dotnet',
    label: '.NET SDK',
    bins: ['dotnet'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=8',
    homepage: 'https://dot.net',
    install: {
      winget: 'Microsoft.DotNet.SDK.8',
      scoop: 'dotnet-sdk',
      choco: 'dotnet-8.0-sdk',
      brew: 'dotnet',
      apt: 'dotnet-sdk-8.0',
    },
  },
  {
    id: 'git',
    label: 'Git',
    bins: ['git'],
    versionArgs: ['--version'],
    versionPattern: /git version\s+(\d+\.\d+(?:\.\d+)?)/,
    defaultRange: '>=2.30',
    homepage: 'https://git-scm.com',
    install: {
      winget: 'Git.Git',
      scoop: 'git',
      choco: 'git',
      brew: 'git',
      apt: 'git',
      dnf: 'git',
      pacman: 'git',
      apk: 'git',
    },
  },
  {
    id: 'docker',
    label: 'Docker',
    bins: ['docker'],
    versionArgs: ['--version'],
    versionPattern: /Docker version\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=24',
    homepage: 'https://docs.docker.com',
    install: {
      winget: 'Docker.DockerDesktop',
      scoop: 'docker',
      choco: 'docker-desktop',
      brew: '--cask docker',
      apt: 'docker.io',
      dnf: 'docker',
      pacman: 'docker',
    },
  },
  {
    id: 'make',
    label: 'GNU Make',
    bins: ['make'],
    versionArgs: ['--version'],
    versionPattern: /Make\s+(\d+\.\d+)/,
    defaultRange: '>=4',
    homepage: 'https://www.gnu.org/software/make',
    install: {
      winget: 'GnuWin32.Make',
      scoop: 'make',
      choco: 'make',
      brew: 'make',
      apt: 'make',
      dnf: 'make',
      pacman: 'make',
      apk: 'make',
    },
  },
  {
    id: 'gcc',
    label: 'GCC',
    bins: ['gcc', 'cc'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=11',
    homepage: 'https://gcc.gnu.org',
    install: {
      winget: 'MSYS2.MSYS2',
      scoop: 'mingw',
      choco: 'mingw',
      brew: 'gcc',
      apt: 'gcc',
      dnf: 'gcc',
      pacman: 'gcc',
      apk: 'gcc',
    },
  },
  {
    id: 'cmake',
    label: 'CMake',
    bins: ['cmake'],
    versionArgs: ['--version'],
    versionPattern: /cmake version\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=3.20',
    homepage: 'https://cmake.org',
    install: {
      winget: 'Kitware.CMake',
      scoop: 'cmake',
      choco: 'cmake',
      brew: 'cmake',
      apt: 'cmake',
      dnf: 'cmake',
      pacman: 'cmake',
      apk: 'cmake',
    },
  },
  {
    id: 'ruby',
    label: 'Ruby',
    bins: ['ruby'],
    versionArgs: ['--version'],
    versionPattern: /ruby\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=3.1',
    homepage: 'https://www.ruby-lang.org',
    install: {
      winget: 'RubyInstallerTeam.Ruby.3.3',
      scoop: 'ruby',
      choco: 'ruby',
      brew: 'ruby',
      apt: 'ruby-full',
      dnf: 'ruby',
      pacman: 'ruby',
      apk: 'ruby',
    },
  },
  {
    id: 'php',
    label: 'PHP',
    bins: ['php'],
    versionArgs: ['--version'],
    versionPattern: /PHP\s+(\d+\.\d+\.\d+)/,
    defaultRange: '>=8.1',
    homepage: 'https://www.php.net',
    install: {
      winget: 'PHP.PHP.8.3',
      scoop: 'php',
      choco: 'php',
      brew: 'php',
      apt: 'php',
      dnf: 'php',
      pacman: 'php',
      apk: 'php83',
    },
  },
  {
    id: 'sqlite3',
    label: 'SQLite',
    bins: ['sqlite3'],
    versionArgs: ['--version'],
    versionPattern: /(\d+\.\d+\.\d+)/,
    defaultRange: '>=3.35',
    homepage: 'https://sqlite.org',
    install: {
      winget: 'SQLite.SQLite',
      scoop: 'sqlite',
      choco: 'sqlite',
      brew: 'sqlite',
      apt: 'sqlite3',
      dnf: 'sqlite',
      pacman: 'sqlite',
      apk: 'sqlite',
    },
  },
  {
    id: 'psql',
    label: 'PostgreSQL client',
    bins: ['psql'],
    versionArgs: ['--version'],
    versionPattern: /PostgreSQL\)\s+(\d+\.\d+(?:\.\d+)?)/,
    defaultRange: '>=15',
    homepage: 'https://www.postgresql.org',
    install: {
      winget: 'PostgreSQL.PostgreSQL.16',
      scoop: 'postgresql',
      brew: 'postgresql@16',
      apt: 'postgresql-client',
      dnf: 'postgresql',
      pacman: 'postgresql',
      apk: 'postgresql-client',
    },
  },
];

/** Aliases users type instead of the canonical id. */
const ALIASES = new Map([
  ['nodejs', 'node'],
  ['node-js', 'node'],
  ['py', 'python'],
  ['python3', 'python'],
  ['golang', 'go'],
  ['rust', 'rustc'],
  ['cargo-rust', 'cargo'],
  ['jdk', 'java'],
  ['openjdk', 'java'],
  ['dotnet-sdk', 'dotnet'],
  ['postgres', 'psql'],
  ['postgresql', 'psql'],
  ['gcc-c++', 'gcc'],
  ['gpp', 'gcc'],
]);

/** @type {Map<string, ToolSpec>} */
const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

/** Canonical id for a user-supplied name, or null when unknown. */
export function canonicalId(name) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (BY_ID.has(key)) return key;
  return ALIASES.get(key) ?? null;
}

/** @returns {ToolSpec | null} */
export function getTool(id) {
  const canonical = canonicalId(id);
  return canonical ? (BY_ID.get(canonical) ?? null) : null;
}

/** All known tool ids, in display order. */
export function toolIds() {
  return TOOLS.map((tool) => tool.id);
}

/**
 * Build a tool spec for a definition that is not in the registry.
 * The manifest must then provide `bin` (and ideally `versionPattern`).
 *
 * @param {string} id
 * @param {{bin?: string|string[], versionArgs?: string[], versionPattern?: string, range?: string}} definition
 * @returns {ToolSpec}
 */
export function customTool(id, definition = {}) {
  const bins = definition.bin
    ? Array.isArray(definition.bin)
      ? definition.bin
      : [definition.bin]
    : [id];
  return {
    id,
    label: id,
    bins,
    versionArgs: definition.versionArgs ?? ['--version'],
    versionPattern: definition.versionPattern
      ? new RegExp(definition.versionPattern)
      : /(\d+\.\d+(?:\.\d+)?)/,
    defaultRange: definition.range ?? 'any',
    install: {},
    note: 'custom tool (no installer known)',
  };
}
