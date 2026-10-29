# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-29

First public release.

### Added

- `envup check` — verify every tool in `envup.json` against the machine, with a human table,
  a one-line mode (`--quiet`) and a machine-readable mode (`--json`).
- `envup install` — map missing tools onto `winget`, `scoop`, `choco`, `brew`, `apt`, `dnf`,
  `pacman`, `zypper` or `apk`, print the exact commands, and execute them after confirmation.
  `--dry-run` stops before execution; commands that need root require `--sudo`.
- `envup init` — detect a project's toolchain from `package.json`, `.nvmrc`, `.node-version`,
  `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `rust-toolchain.toml`,
  `pom.xml`, `build.gradle`, `global.json`, `Gemfile`, `composer.json`, `Dockerfile`,
  `.tool-versions` and 11 lockfile names, recording the source of every requirement.
- `envup doctor` — diagnose `PATH` entries, duplicate binaries, shadowed installs, package
  managers and proxy settings.
- `envup add` / `envup remove` — edit the manifest without hand-editing JSON.
- 24 built-in tool definitions with per-platform package ids, plus custom tools via `bin`,
  `versionArgs` and `versionPattern`.
- A dependency-free semver subset: `^`, `~`, `>=`, `>`, `<=`, `<`, `=`, partial versions,
  `x`-wildcards and `||`.
- Programmatic API: `checkEnvironment`, `parseManifest`, `scanProject`, `planInstall`,
  `detectManagers`.
- Windows support for `.cmd`/`.bat` shims, UTF-8 BOM manifests and Store app aliases.
- File-backed output capture fallback for environments that forbid anonymous pipes.

[Unreleased]: https://github.com/fless0186/envup/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fless0186/envup/releases/tag/v1.0.0
