import readline from 'node:readline/promises';

import { checkEnvironment } from '../core/check.js';
import { isPrivileged, detectManagers } from '../core/platform.js';
import { planInstall } from '../core/installs.js';
import { INDENT, padEnd } from '../core/style.js';

/**
 * `envup install` — install whatever `envup check` reported as missing.
 *
 * Safety model:
 *   - nothing runs without an explicit confirmation or --yes
 *   - --dry-run prints the exact commands and exits
 *   - commands that need root are refused unless --sudo is passed
 *
 * @returns {Promise<number>} exit code
 */
export async function installCommand(ctx) {
  const { style, options } = ctx;

  const before = await checkEnvironment({
    dir: ctx.cwd,
    context: ctx.context,
    only: options.only,
  });

  const pending = before.results.filter(
    (tool) => tool.status === 'missing' || tool.status === 'mismatch',
  );

  if (pending.length === 0) {
    if (options.json) {
      ctx.write(`${JSON.stringify({ name: before.manifest.name, plan: [], executed: [] }, null, 2)}\n`);
      return 0;
    }
    ctx.out();
    ctx.out(`${INDENT}${style.bold('envup install')} ${style.dim('·')} ${before.manifest.name}`);
    ctx.out();
    ctx.out(`${INDENT}${style.green(style.symbols.ok)} nothing to install — every requirement is satisfied`);
    return 0;
  }

  const managers = await detectManagers(ctx.context);
  const managerIds = managers.map((manager) => manager.id);
  const privileged = isPrivileged();

  const plan = pending.map((tool) => ({
    tool,
    plan: planInstall(tool.spec, { managers: managerIds, platform: ctx.platform, privileged }),
  }));

  const planJson = {
    name: before.manifest.name,
    managers: managers.map((manager) => manager.id),
    plan: plan.map(({ tool, plan: item }) => ({
      id: tool.id,
      manager: item.manager || null,
      command: item.supported ? item.display : null,
      supported: item.supported,
      reason: item.reason ?? null,
    })),
  };

  if (options.json && !options.yes) {
    // A plan without consent: print it and stop, one JSON document.
    ctx.write(`${JSON.stringify(planJson, null, 2)}\n`);
    return 0;
  }

  if (!options.json) {
    const idWidth = Math.max(6, ...plan.map(({ tool }) => tool.id.length));
    ctx.out();
    ctx.out(`${INDENT}${style.bold('envup install')} ${style.dim('·')} ${before.manifest.name}`);
    ctx.out();
    for (const { tool, plan: item } of plan) {
      if (item.supported) {
        ctx.out(`${INDENT}${padEnd(tool.id, idWidth)}  ${item.display}`);
      } else {
        ctx.out(`${INDENT}${padEnd(tool.id, idWidth)}  ${style.dim(item.reason)}`);
        if (item.hint) ctx.out(`${INDENT}${' '.repeat(idWidth)}  ${style.dim(item.hint)}`);
      }
    }
    ctx.out();
  }

  if (options.dryRun) {
    if (!options.json) ctx.out(`${INDENT}${style.dim('dry run — nothing was executed')}`);
    return 0;
  }

  const installable = plan.filter(({ plan: item }) => item.supported);
  const blocked = plan.filter(({ plan: item }) => !item.supported);

  if (installable.length === 0) {
    if (!options.json) {
      ctx.out(`${INDENT}${style.yellow(style.symbols.warn)} no supported installer for these tools`);
      ctx.out(`${INDENT}  install them manually, then run ${style.cyan('envup check')}`);
    }
    return 1;
  }

  if (!options.yes) {
    if (!options.json) {
      if (!ctx.interactive) {
        ctx.err(
          `${INDENT}refusing to install without confirmation in a non-interactive shell — re-run with --yes`,
        );
        return 2;
      }
      const answer = await ask(`${INDENT}Install ${installable.length} tool(s)? [y/N] `);
      if (!/^y(es)?$/i.test(answer.trim())) {
        ctx.out(`${INDENT}aborted — nothing was installed`);
        return 1;
      }
      ctx.out();
    }
  }

  const executed = [];
  for (const { tool, plan: item } of installable) {
    if (item.requiresSudo && !options.sudo) {
      executed.push({ id: tool.id, ok: false, skipped: true, command: item.display });
      if (!options.json) {
        ctx.out(`${INDENT}${style.yellow(style.symbols.warn)}  ${tool.id} needs sudo — skipped (pass --sudo to allow it)`);
      }
      continue;
    }

    if (!options.json) ctx.out(`${INDENT}${style.dim('run')}  ${item.display}`);
    const code = await ctx.runner.runInteractive(item.command.file, item.command.args, { cwd: ctx.cwd });
    const ok = code === 0;
    executed.push({ id: tool.id, ok, code, command: item.display });
    if (!options.json) {
      ctx.out(
        `${INDENT}${ok ? style.green(style.symbols.ok) : style.red(style.symbols.bad)}  ${tool.id} ${style.dim(ok ? 'installed' : `installer exited with ${code}`)}`,
      );
      ctx.out();
    }
    if (!ok && !options.keepGoing) break;
  }

  if (options.json) {
    ctx.write(`${JSON.stringify({ ...planJson, executed }, null, 2)}\n`);
    return executed.every((entry) => entry.ok) ? 0 : 1;
  }

  // Re-check so the summary reflects reality rather than the installer's exit code
  // (versions can be installed but shadowed by an older one earlier on PATH).
  const after = await checkEnvironment({ dir: ctx.cwd, context: ctx.context, only: options.only });

  for (const tool of after.results) {
    if (tool.status === 'ok') {
      ctx.out(`${INDENT}${style.green(style.symbols.ok)}  ${padEnd(tool.id, 8)} ${tool.found}`);
    } else {
      const note =
        tool.status === 'mismatch'
          ? `still ${tool.found} — an older install earlier on PATH may be shadowing the new one`
          : tool.status === 'missing'
            ? 'still not found on PATH — you may need a new shell'
            : 'version still unreadable';
      ctx.out(`${INDENT}${style.red(style.symbols.bad)}  ${padEnd(tool.id, 8)} ${style.dim(note)}`);
    }
  }

  ctx.out();
  const remaining = after.summary.missing + after.summary.mismatch;
  if (remaining === 0) {
    ctx.out(`${INDENT}${style.green('environment ready')}`);
    return 0;
  }
  ctx.out(
    `${INDENT}${style.yellow(style.symbols.warn)} ${remaining} tool(s) still need attention` +
      (blocked.length ? ` · ${blocked.length} had no installer` : ''),
  );
  return 1;
}

/** Prompt on stdin. The test suite never reaches this: it passes --yes. */
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
