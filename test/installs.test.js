import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCommand, planInstall } from '../src/core/installs.js';
import { customTool, getTool } from '../src/core/registry.js';

test('planInstall prefers winget on Windows', () => {
  const plan = planInstall(getTool('go'), {
    managers: ['winget', 'npm'],
    platform: 'win32',
    privileged: false,
  });
  assert.equal(plan.supported, true);
  assert.equal(plan.manager, 'winget');
  assert.equal(plan.command.file, 'winget');
  assert.equal(plan.requiresSudo, false);
  assert.match(plan.display, /winget install --id GoLang\.Go/);
});

test('planInstall honours per-tool manager preference', () => {
  const plan = planInstall(getTool('pnpm'), {
    managers: ['winget', 'npm'],
    platform: 'win32',
    privileged: false,
  });
  assert.equal(plan.manager, 'npm');
  assert.deepEqual(plan.command.args, ['install', '-g', 'pnpm']);
});

test('planInstall marks apt installs as needing sudo', () => {
  const plan = planInstall(getTool('go'), {
    managers: ['apt', 'npm'],
    platform: 'linux',
    privileged: false,
  });
  assert.equal(plan.requiresSudo, true);
  assert.equal(plan.command.file, 'sudo');
  assert.match(plan.display, /^sudo apt-get install -y golang-go$/);
});

test('planInstall skips sudo when already root', () => {
  const plan = planInstall(getTool('go'), {
    managers: ['apt'],
    platform: 'linux',
    privileged: true,
  });
  assert.equal(plan.requiresSudo, false);
  assert.equal(plan.command.file, 'apt-get');
  assert.match(plan.display, /^apt-get install -y golang-go$/);
});

test('planInstall keeps brew flags like --cask', () => {
  const plan = planInstall(getTool('docker'), {
    managers: ['brew'],
    platform: 'darwin',
    privileged: false,
  });
  assert.deepEqual(plan.command.args, ['install', '--cask', 'docker']);
});

test('planInstall explains when no manager can install a tool', () => {
  const plan = planInstall(getTool('go'), { managers: ['npm'], platform: 'linux' });
  assert.equal(plan.supported, false);
  assert.match(plan.reason, /no package manager/);
});

test('custom tools have no installer and say so', () => {
  const plan = planInstall(customTool('ripgrep', { bin: 'rg' }), {
    managers: ['brew'],
    platform: 'darwin',
  });
  assert.equal(plan.supported, false);
  assert.match(plan.reason, /no installer/);
});

test('formatCommand quotes arguments with spaces', () => {
  assert.equal(
    formatCommand({ file: 'brew', args: ['install', 'python@3.12'] }),
    'brew install python@3.12',
  );
  assert.equal(
    formatCommand({ file: 'cmd', args: ['--path', 'C:\\Program Files\\x'] }),
    'cmd --path "C:\\Program Files\\x"',
  );
});
