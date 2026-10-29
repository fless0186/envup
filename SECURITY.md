# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

Please use GitHub's private reporting flow:
**Security → Report a vulnerability** on the repository page.

Do not open a public issue for anything that could be exploited before a fix ships. Expect an
initial response within a few days; this is a volunteer project, so please be patient.

Include the `envup --version`, your OS, the manifest involved, and the command you ran.

## What envup does on your machine

It is worth being precise about the trust model, because `envup install` runs programs:

- `check`, `init`, `doctor`, `add` and `remove` only **read** files and execute tool binaries
  with `--version`. No network access, no writes outside `envup.json`.
- `install` executes package managers (`winget`, `brew`, `apt`, …). It prints every command
  before running it, requires confirmation (or `--yes`), and refuses to run non-interactively
  without `--yes`. Use `--dry-run` to inspect without executing.
- Commands that need root are never escalated automatically; pass `--sudo` to allow the
  `sudo` prefix on Linux.
- No telemetry and no remote schema fetching at runtime.

## Scope

Reportable: command injection through a manifest, path traversal, unsafe handling of tool
output, privilege escalation, or secret leakage.

Out of scope: the behaviour of a package manager invoked by `install`, and vulnerabilities in
third-party tools that envup merely detects.
