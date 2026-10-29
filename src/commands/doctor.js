import fs from 'node:fs';

import { describeSystem, detectManagers } from '../core/platform.js';
import { INDENT, padEnd, truncate } from '../core/style.js';
import { whichAll } from '../core/which.js';

const WATCHED_BINS = ['node', 'python', 'python3', 'pip', 'git', 'docker', 'java', 'go', 'cargo', 'pnpm'];

/**
 * `envup doctor` — diagnose the machine rather than the project.
 * Catches the classic "it is installed but not on PATH" case.
 *
 * @returns {Promise<number>} exit code
 */
export async function doctorCommand(ctx) {
  const { style, options } = ctx;
  const env = ctx.env;
  const platform = ctx.platform;
  const delimiter = platform === 'win32' ? ';' : ':';
  const rawPath = env.PATH ?? env.Path ?? '';
  const entries = rawPath
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);

  const system = describeSystem(env);
  const managers = await detectManagers(ctx.context);
  const warnings = [];

  ctx.out();
  ctx.out(`${INDENT}${style.bold('envup doctor')}`);
  ctx.out();
  ctx.out(`${INDENT}${padEnd('system', 10)}${system.name} ${style.dim(`build ${system.release} · ${system.arch}`)}`);
  ctx.out(`${INDENT}${padEnd('runtime', 10)}Node ${system.node}`);
  ctx.out(`${INDENT}${padEnd('shell', 10)}${truncate(system.shell, 80)}`);
  ctx.out(
    `${INDENT}${padEnd('managers', 10)}${
      managers.length
        ? managers.map((manager) => `${manager.id}${manager.version ? ` ${manager.version}` : ''}`).join(', ')
        : style.yellow('none detected — envup install will fall back to manual instructions')
    }`,
  );
  ctx.out();

  /* ------------------------------------------------------------------ PATH */
  const seen = new Set();
  const duplicates = [];
  const missing = [];
  for (const entry of entries) {
    const key = platform === 'win32' ? entry.toLowerCase() : entry;
    if (seen.has(key)) duplicates.push(entry);
    else seen.add(key);
    try {
      if (!fs.statSync(entry).isDirectory()) missing.push(entry);
    } catch {
      missing.push(entry);
    }
  }

  ctx.out(`${INDENT}${padEnd('path', 10)}${entries.length} entries`);
  for (const entry of missing.slice(0, 8)) {
    ctx.out(`${INDENT}  ${style.yellow(style.symbols.warn)} missing   ${style.dim(entry)}`);
  }
  if (missing.length > 8) ctx.out(`${INDENT}  ${style.dim(`… and ${missing.length - 8} more`)}`);
  for (const entry of duplicates.slice(0, 5)) {
    ctx.out(`${INDENT}  ${style.yellow(style.symbols.warn)} duplicate ${style.dim(entry)}`);
  }
  if (missing.length) warnings.push(`${missing.length} PATH entries do not exist`);
  if (duplicates.length) warnings.push(`${duplicates.length} duplicate PATH entries`);

  if (platform === 'win32' && rawPath.length > 2047) {
    warnings.push('PATH is longer than 2047 characters — older tools may silently fail to find binaries');
  }

  /* ------------------------------------------------------------- duplicates */
  const shadowed = [];
  for (const bin of WATCHED_BINS) {
    // Windows app-execution aliases are stubs that forward to a packaged app;
    // counting them as a second install would be noise, not a diagnosis.
    const found = whichAll(bin, { env, platform }).filter(
      (file) => !/\\microsoft\\windowsapps\\/i.test(file),
    );
    if (found.length > 1) shadowed.push({ bin, found });
  }
  if (shadowed.length) {
    ctx.out();
    ctx.out(`${INDENT}${style.bold('shadowed binaries')}`);
    for (const { bin, found } of shadowed.slice(0, 6)) {
      ctx.out(`${INDENT}${padEnd(bin, 10)}${style.dim(`${found.length} copies — the first one wins`)}`);
      for (const file of found.slice(0, 3)) {
        ctx.out(`${INDENT}${' '.repeat(10)}${style.gray(truncate(file, 90))}`);
      }
    }
    warnings.push(`${shadowed.length} tool(s) exist in more than one place`);
  }

  /* ------------------------------------------------------------------ proxy */
  const proxies = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].filter(
    (name) => env[name],
  );
  if (proxies.length) {
    ctx.out();
    ctx.out(`${INDENT}${padEnd('proxy', 10)}${proxies.map((name) => `${name}=${truncate(env[name], 40)}`).join(' ')}`);
  }

  ctx.out();
  if (warnings.length === 0) {
    ctx.out(`${INDENT}${style.green(style.symbols.ok)} no problems found`);
    return 0;
  }

  ctx.out(`${INDENT}${style.yellow(style.symbols.warn)} ${warnings.length} problem(s) found`);
  for (const warning of warnings) ctx.out(`${INDENT}  ${style.dim(`· ${warning}`)}`);

  return options.strict ? 1 : 0;
}
