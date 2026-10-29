/**
 * Terminal styling with no dependencies.
 *
 * Colour is opt-out via --no-color, NO_COLOR, or a non-TTY stdout; symbols can
 * fall back to ASCII with --ascii or ENVUP_ASCII=1 for legacy consoles.
 */

const CODES = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  red: '\u001B[31m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  magenta: '\u001B[35m',
  cyan: '\u001B[36m',
  gray: '\u001B[90m',
};

const SYMBOLS = {
  unicode: { ok: '✓', bad: '✗', warn: '!', info: '·' },
  ascii: { ok: '+', bad: 'x', warn: '!', info: '-' },
};

/**
 * @param {{color?: boolean, ascii?: boolean}} [options]
 */
export function createStyle(options = {}) {
  const color = options.color ?? true;
  const symbols = options.ascii ? SYMBOLS.ascii : SYMBOLS.unicode;

  const wrap = (codes) => (text) => (color ? `${codes}${text}${CODES.reset}` : String(text));

  return {
    color,
    symbols,
    bold: wrap(CODES.bold),
    dim: wrap(CODES.dim),
    red: wrap(CODES.red),
    green: wrap(CODES.green),
    yellow: wrap(CODES.yellow),
    cyan: wrap(CODES.cyan),
    gray: wrap(CODES.gray),

    /** Status marker, coloured. */
    mark(status) {
      switch (status) {
        case 'ok':
          return this.green(symbols.ok);
        case 'missing':
        case 'mismatch':
          return this.red(symbols.bad);
        case 'unknown':
          return this.yellow(symbols.warn);
        default:
          return symbols.info;
      }
    },

    /** Colour by status for free-form text. */
    status(status, text) {
      if (status === 'ok') return this.green(text);
      if (status === 'unknown') return this.yellow(text);
      if (status === 'missing' || status === 'mismatch') return this.red(text);
      return String(text);
    },

    error: (text) => (color ? `${CODES.red}${text}${CODES.reset}` : String(text)),
    warn: (text) => (color ? `${CODES.yellow}${text}${CODES.reset}` : String(text)),
  };
}

/** Decide whether colour is appropriate for this process. */
export function shouldUseColor({ env = process.env, isTTY = process.stdout.isTTY } = {}) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '' && env.NO_COLOR !== '0') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '' && env.FORCE_COLOR !== '0') return true;
  return Boolean(isTTY);
}

/** Pad to a visible width, ignoring ANSI escapes. */
export function padEnd(text, width) {
  const visible = String(text).replace(/\u001B\[[0-9;]*m/g, '').length;
  return visible >= width ? String(text) : String(text) + ' '.repeat(width - visible);
}

/** Truncate long text with an ellipsis, ignoring ANSI escapes. */
export function truncate(text, width) {
  const plain = String(text).replace(/\u001B\[[0-9;]*m/g, '');
  if (plain.length <= width) return String(text);
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

export const INDENT = '  ';
