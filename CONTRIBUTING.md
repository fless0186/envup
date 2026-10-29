# Contributing

Thanks for taking the time to help. `envup` is deliberately small: a CLI, a check engine and
a table of tools. Most contributions are one of three things.

## Setup

```bash
git clone https://github.com/fless0186/envup.git
cd envup
npm install          # no dependencies, this only writes the lockfile
npm test             # node --test
npm run demo         # run init/check against a throwaway project
```

Node.js 20 or newer. There is no build step and there are no runtime dependencies — please
keep it that way.

## Layout

```
bin/envup.js            entry point (shebang + exit code)
src/cli.js              argument parsing, context creation, error rendering
src/commands/           one file per command: check, install, init, doctor, manifest-edit
src/core/semver.js      version parsing, comparison, range grammar
src/core/registry.js    the tool table (the file to edit for a new tool)
src/core/which.js       PATH lookups, no shelling out
src/core/detect.js      run a tool, read its version
src/core/runner.js      process execution (+ file-backed fallback)
src/core/project.js     `init` heuristics
src/core/installs.js    manager → install command translation
test/                   node:test suite
```

## Add a tool

Add one object to `TOOLS` in `src/core/registry.js`:

```js
{
  id: 'ripgrep',
  label: 'ripgrep',
  bins: ['rg'],
  versionArgs: ['--version'],
  versionPattern: /ripgrep (\d+\.\d+\.\d+)/,
  defaultRange: '>=13',
  homepage: 'https://github.com/BurntSushi/ripgrep',
  install: {
    winget: 'BurntSushi.ripgrep.MSVC',
    scoop: 'ripgrep',
    brew: 'ripgrep',
    apt: 'ripgrep',
  },
}
```

Then add a test case in `test/check.test.js`-style fixtures if the output format is unusual,
run `npm test`, and mention the package ids you verified in the pull request.

## Add a version range form

`src/core/semver.js` has a table-driven test file. Behaviour changes must come with cases in
`test/semver.test.js`, including at least one case that must **not** match.

## Style

- Plain ESM JavaScript, no TypeScript, no transpiler.
- Two-space indent, single quotes, trailing commas.
- Prefer a pure function plus an injected `runner`/`env` over reaching for globals; that is
  what keeps the suite hermetic.
- Comments explain *why*. The code already says what.
- Every user-visible string is plain ASCII unless it is a status glyph.

## Commits and pull requests

Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`) are
appreciated, not enforced. A pull request should:

1. pass `npm test` on your platform,
2. keep `node bin/envup.js check .` green,
3. include a test for new behaviour,
4. update `README.md` (and `README.zh-CN.md` for user-facing changes),
5. not add a runtime dependency.

## Release

1. Update `CHANGELOG.md` and bump `package.json`.
2. `npm test`.
3. `git tag v1.x.y && git push --tags`.
4. The `Release` workflow publishes to npm with provenance and creates the GitHub release.
   It needs an `NPM_TOKEN` repository secret.

## First thing to do after forking

The repository ships with `fless0186/envup` placeholders (badge URLs, repository links, schema
URLs). Replace them in one shot:

```bash
node scripts/rename.mjs your-github-name
```
