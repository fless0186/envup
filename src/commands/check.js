import { checkEnvironment, checkExitCode, toJson } from '../core/check.js';
import { INDENT, padEnd } from '../core/style.js';

/** Human explanation for a non-ok status. */
function explain(tool) {
  switch (tool.status) {
    case 'missing':
      return 'not found on PATH';
    case 'mismatch':
      return `found ${tool.found}, needs ${tool.range}`;
    case 'unknown':
      return 'could not read a version from the tool output';
    default:
      return '';
  }
}

/**
 * `envup check` — verify the machine satisfies envup.json.
 * @returns {Promise<number>} exit code
 */
export async function checkCommand(ctx) {
  const { style, options } = ctx;
  const result = await checkEnvironment({
    dir: ctx.cwd,
    context: ctx.context,
    only: options.only,
  });

  const exitCode = checkExitCode(result, { strict: options.strict });

  if (options.json) {
    ctx.write(`${JSON.stringify(toJson(result), null, 2)}\n`);
    return exitCode;
  }

  if (options.quiet) {
    ctx.out(summaryText(result, style));
    return exitCode;
  }

  const idWidth = Math.max(6, ...result.results.map((tool) => tool.id.length));
  const versionWidth = Math.max(8, ...result.results.map((tool) => (tool.found ?? '—').length));

  ctx.out();
  ctx.out(`${INDENT}${style.bold('envup check')} ${style.dim('·')} ${result.manifest.name}`);
  ctx.out();

  for (const tool of result.results) {
    const version = tool.found ?? '—';
    const line = [
      `${INDENT}${style.mark(tool.status)}  `,
      padEnd(tool.id, idWidth),
      '  ',
      padEnd(version, versionWidth),
      '  ',
      style.dim(tool.range),
    ].join('');
    ctx.out(line);

    const note = explain(tool);
    if (note) ctx.out(`${INDENT}      ${style.dim(note)}`);
    if (options.verbose && tool.path) ctx.out(`${INDENT}      ${style.gray(tool.path)}`);
  }

  ctx.out();
  ctx.out(`${INDENT}${summaryText(result, style)}`);

  const pending = result.results.filter((tool) => tool.status === 'missing' || tool.status === 'mismatch');
  if (pending.length) {
    ctx.out(`${INDENT}${style.dim('next')}  envup install ${pending.map((tool) => tool.id).join(' ')}`);
  }

  return exitCode;
}

/** "4 ok · 1 missing" with status colouring. */
export function summaryText(result, style) {
  const { summary } = result;
  const parts = [];
  if (summary.ok) parts.push(style.green(`${summary.ok} ok`));
  if (summary.missing) parts.push(style.red(`${summary.missing} missing`));
  if (summary.mismatch) parts.push(style.red(`${summary.mismatch} outdated`));
  if (summary.unknown) parts.push(style.yellow(`${summary.unknown} unknown`));
  if (parts.length === 0) return style.dim('nothing to check');
  return parts.join(style.dim(' · '));
}
