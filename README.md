# envup

**One manifest, one command: know whether a machine can run this project — and fix it if it can't.**

[![npm](https://img.shields.io/npm/v/envup?color=cb3837&logo=npm)](https://www.npmjs.com/package/envup)
[![node](https://img.shields.io/node/v/envup?color=5fa04e&logo=node.js)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/fless0186/envup/actions/workflows/ci.yml/badge.svg)](https://github.com/fless0186/envup/actions/workflows/ci.yml)

`envup` reads a small `envup.json` describing the tools a project needs, verifies every one of
them against the machine, and can install whatever is missing using the package manager you
already have — `winget`, `brew`, `apt`, `dnf`, `pacman`, `scoop`, `choco` or `npm`.

No daemons, no containers, no version-manager lock-in, **no dependencies at all**.

```console
$ envup check
  envup check · acme-web

  ✓  node    24.22.1   >=20
  ✓  python  3.13.17   >=3.11
  ✗  go      —         >=1.22
        not found on PATH
  ✗  docker  —         >=24
        not found on PATH

  2 ok · 2 missing
  next  envup install go docker
```

---

## Why

Onboarding instructions rot. "Install Node 20+ and Python 3.11" turns into a 40-minute
archaeology session, and the failures are always the same three shapes:

- a tool is missing entirely,
- a tool is installed but **not the version the project needs**, or
- a tool is installed but **not visible on `PATH`** (the classic Windows / WSL trap).

`envup` collapses all three into one command with a deterministic exit code, so the same
check runs on a laptop, in a Dockerfile and in CI.

## Quick start

```console
$ npx envup init      # scan the repo, write envup.json
$ npx envup check     # verify the machine against it
$ npx envup install   # install what is missing
```

`init` looks at what your project already declares — `package.json` (`engines`,
`packageManager`), `.nvmrc`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`,
`build.gradle`, `global.json`, `Gemfile`, `composer.json`, `Dockerfile`, `.tool-versions`,
lockfiles — and tells you where each requirement came from:

```console
$ envup init
  envup init · acme-web

  ✓  node    >=20      package.json engines.node
  ✓  pnpm    >=9.12.0  package.json packageManager
  ✓  python  >=3.11    pyproject.toml requires-python
  ✓  go      >=1.22    go.mod
  ✓  git     >=2.30    .git
  ✓  docker  >=24      Dockerfile / compose file

  created /home/ana/acme-web/envup.json
  next  envup check
```

## Install

```bash
npm install -g envup     # global
npx envup --help         # or on demand, no install
```

Requires Node.js 20 or newer. Works on Windows, macOS and Linux (including WSL).

## Commands

| Command | What it does |
| --- | --- |
| `envup check [dir]` | Verify every tool in `envup.json`. The default command. |
| `envup install [dir]` | Plan and run the install commands for anything missing. |
| `envup init [dir]` | Detect the toolchain and write `envup.json`. |
| `envup doctor` | Diagnose the machine: `PATH` health, shadowed binaries, package managers. |
| `envup add <tool>[@range]…` | Add requirements without hand-editing JSON. |
| `envup remove <tool>…` | Remove requirements. |

Useful flags:

| Flag | Effect |
| --- | --- |
| `--json` | Machine-readable output for scripts and CI. |
| `--only node,python` | Restrict `check` / `install` to specific tools. |
| `--strict` | Treat warnings (unreadable versions) as failures. |
| `--dry-run` | Print install commands without running them. |
| `--yes` / `-y` | Skip the confirmation prompt. |
| `--sudo` | Allow the `sudo` commands `install` needs on Debian-likes. |
| `--verbose` | Show the resolved path of each tool. |
| `--quiet` / `-q` | One-line summary. |
| `--no-color`, `--ascii` | Plain output for logs and legacy consoles. |

Exit codes: **0** everything satisfied · **1** something is missing or outdated · **2** usage
or configuration error. That is the whole integration surface.

## The manifest

```json
{
  "$schema": "https://raw.githubusercontent.com/fless0186/envup/main/envup.schema.json",
  "name": "acme-web",
  "tools": {
    "node": ">=20",
    "pnpm": ">=9.12.0",
    "python": { "range": ">=3.11", "bin": "python3" }
  }
}
```

- `name` — optional, defaults to the directory name.
- `tools` — tool id to version range. The string shorthand means "this range, default binary".

A tool envup has never heard of needs a `bin`; everything else is optional:

```json
{
  "tools": {
    "ripgrep": {
      "bin": "rg",
      "range": ">=13",
      "versionArgs": ["--version"],
      "versionPattern": "(\\d+\\.\\d+\\.\\d+)"
    }
  }
}
```

`versionPattern` must put the version in capture group 1. `bin` accepts an array when a tool
has more than one common name (`["python3", "python", "py"]`).

## Version ranges

A pragmatic subset of semver — enough to express real requirements, small enough to stay
predictable:

| Syntax | Means |
| --- | --- |
| `any`, `*`, `""` | anything installed |
| `20.11.1` | exactly that version |
| `20.11` / `20.11.x` | `>=20.11.0 <20.12.0` |
| `20` / `20.x` | `>=20.0.0 <21.0.0` |
| `^20.11.0` | `>=20.11.0 <21.0.0` (for `0.x`, the minor is pinned instead) |
| `~3.11` | `>=3.11.0 <3.12.0` |
| `>=3.11 <4` | both bounds |

Alternatives are written with a double pipe — `>=20 || >=22` accepts either line.

Pre-release versions compare correctly (a release outranks its own pre-releases).

## Supported tools

| ID | Default | ID | Default |
| --- | --- | --- | --- |
| `node` | `>=20` | `go` | `>=1.22` |
| `npm` | `>=10` | `rustc` | `>=1.75` |
| `pnpm` | `>=9` | `cargo` | `>=1.75` |
| `yarn` | `>=1` | `java` | `>=17` |
| `bun` | `>=1` | `dotnet` | `>=8` |
| `deno` | `>=1` | `git` | `>=2.30` |
| `python` | `>=3.10` | `docker` | `>=24` |
| `pip` | `>=23` | `make` | `>=4` |
| `uv` | `>=0.4` | `gcc` | `>=11` |
| `poetry` | `>=1.8` | `cmake` | `>=3.20` |
| `php` | `>=8.1` | `ruby` | `>=3.1` |
| `sqlite3` | `>=3.35` | `psql` | `>=15` |

Aliases work too (`golang` → `go`, `nodejs` → `node`, `py` → `python`). Any other tool can be
declared with a custom `bin` — the check engine is generic.

## In CI

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx envup check --strict
```

For scripts, skip the renderer entirely:

```console
$ envup check --json
{
  "schemaVersion": 1,
  "name": "acme-web",
  "manifest": "/repo/envup.json",
  "ok": false,
  "summary": { "total": 4, "ok": 2, "missing": 2, "mismatch": 0, "unknown": 0 },
  "tools": [
    { "id": "go", "range": ">=1.22", "status": "missing", "found": null, "path": null, "custom": false }
  ]
}
```

## What `envup` will not do

- **No silent installs.** `install` prints the exact commands, asks for confirmation, and
  `--dry-run` stops there. In a non-interactive shell it refuses to run without `--yes`.
- **No automatic `sudo`.** Commands that need root are skipped unless you pass `--sudo`.
- **No `PATH` edits, no shell-profile surgery, no global version-manager state.**
- **No network calls, no telemetry.** Version detection runs local binaries only.
- **No `git` needed.** Detection is filesystem-based.

## How it works

1. `envup.json` is parsed and validated (`--json` errors are still human-readable).
2. Each `bin` is resolved against `PATH` — by listing directories once and matching
   case-insensitively on Windows, which also bypasses the `stat` failures that Windows
   app-execution aliases produce.
3. The tool is asked for its version and the first number in its output is compared using the
   range grammar above.
4. `install` maps the missing tools onto whichever package manager exists here, preferring the
   tool's own ecosystem (pnpm comes from npm when npm is present, not from an OS index).

Edge cases handled on purpose: batch shims on Windows (`npm.cmd`, `pnpm.cmd`), UTF-8 BOMs in
JSON, `python.exe` Store aliases that report nothing, `docker --cask` on Homebrew, and
environments that forbid anonymous pipes (envup falls back to file-backed capture).

## Limitations

- Checks the directory you point it at. For a monorepo, run it per package.
- Reads versions from stdout/stderr text. A tool that prints nothing useful shows up as
  `unknown` — `--strict` turns that into a failure.
- Installing does not fix a `PATH` that shadows the new binary; `envup doctor` explains when
  that happens.

## Programmatic API

```js
import { checkEnvironment } from 'envup';

const { summary, results } = await checkEnvironment({ dir: process.cwd() });
if (summary.missing > 0) process.exit(1);
```

The package also exports `parseManifest`, `scanProject`, `planInstall`, `detectManagers` and
the version helpers.

## Roadmap

- `envup lock` — pin the exact versions that passed, so CI and laptops agree.
- `envup init` in monorepo mode (workspace discovery).
- Homebrew tap and a standalone binary.

## Contributing

Bug reports, tool additions and range-grammar corner cases are all welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). Adding a tool is usually one object in
`src/core/registry.js`, and the repository has no runtime dependencies to keep it that way.

中文说明见 [README.zh-CN.md](README.zh-CN.md)。

## License

[MIT](LICENSE) © envup contributors
