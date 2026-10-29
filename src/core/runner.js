import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Process execution.
 *
 * Version probes normally go through `execFile`, which reads the child's
 * stdout/stderr from anonymous pipes. A handful of hardened environments
 * (locked-down CI runners, some Windows EDR setups, sandboxes that forbid
 * named-pipe creation) reject that with EPERM before the process even starts.
 * In that case envup retries with file-backed stdio, which only needs the
 * temporary directory. The fallback is transparent to callers.
 */

/** Quote one argument for cmd.exe. */
function quoteForCmd(value) {
  const text = String(value);
  if (!/[\s"&|<>^()]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function isBatchFile(file) {
  return /\.(cmd|bat)$/i.test(file);
}

/**
 * @typedef {object} RunResult
 * @property {boolean} ok
 * @property {number|null} code
 * @property {string} stdout
 * @property {string} stderr
 * @property {string} output combined stdout + stderr
 * @property {boolean} timedOut
 */

function resultFrom(error, stdout, stderr, timedOut = false) {
  const out = String(stdout ?? '');
  const err = String(stderr ?? '');
  return {
    ok: !error,
    code: error ? Number(error.code ?? 1) : 0,
    stdout: out,
    stderr: err,
    output: `${out}${err}`.trim(),
    timedOut: timedOut || Boolean(error && error.killed),
  };
}

/**
 * @param {{timeout?: number, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, tmpDir?: string}} [options]
 */
export function createRunner(options = {}) {
  const timeout = options.timeout ?? 10_000;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const tmpRoot = options.tmpDir ?? os.tmpdir();
  let counter = 0;

  /** Resolve a shell shim to something spawnable. */
  function resolveInvocation(file, args) {
    if (platform === 'win32' && isBatchFile(file)) {
      // `cmd /s /c` strips the first and last quote of its argument, so the
      // command itself has to be wrapped in one extra pair: ""C:\a b\x.cmd" --version".
      const line = [file, ...args].map(quoteForCmd).join(' ');
      return {
        command: env.ComSpec ?? 'cmd.exe',
        argv: ['/d', '/s', '/c', `"${line}"`],
        verbatim: true,
      };
    }
    return { command: file, argv: args, verbatim: false };
  }

  function runPiped(command, argv, runOptions, verbatim = false) {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        execFile(
          command,
          argv,
          {
            timeout: runOptions.timeout ?? timeout,
            cwd: runOptions.cwd,
            env,
            windowsHide: true,
            windowsVerbatimArguments: verbatim,
            maxBuffer: 8 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            settled = true;
            resolve(resultFrom(error, stdout, stderr));
          },
        );
      } catch (error) {
        if (!settled) reject(error);
      }
    });
  }

  function runFileBacked(command, argv, runOptions, verbatim = false) {
    return new Promise((resolve) => {
      const stamp = `${process.pid}-${Date.now().toString(36)}-${counter++}`;
      const outPath = path.join(tmpRoot, `.envup-${stamp}.out`);
      const errPath = path.join(tmpRoot, `.envup-${stamp}.err`);
      /** @type {number[]} */
      const fds = [];

      const cleanup = () => {
        for (const fd of fds) {
          try {
            fs.closeSync(fd);
          } catch {
            /* already closed */
          }
        }
        for (const file of [outPath, errPath]) {
          try {
            fs.unlinkSync(file);
          } catch {
            /* already gone */
          }
        }
      };

      let outFd;
      let errFd;
      try {
        outFd = fs.openSync(outPath, 'w');
        fds.push(outFd);
        errFd = fs.openSync(errPath, 'w');
        fds.push(errFd);
      } catch (error) {
        cleanup();
        resolve(resultFrom(error, '', ''));
        return;
      }

      const read = (file) => {
        try {
          return fs.readFileSync(file, 'utf8');
        } catch {
          return '';
        }
      };

      let child;
      try {
        child = spawn(command, argv, {
          stdio: ['ignore', outFd, errFd],
          cwd: runOptions.cwd,
          env,
          windowsHide: true,
          windowsVerbatimArguments: verbatim,
        });
      } catch (error) {
        cleanup();
        resolve(resultFrom(error, '', ''));
        return;
      }

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          /* already gone */
        }
      }, runOptions.timeout ?? timeout);

      child.on('error', (error) => {
        clearTimeout(timer);
        const stdout = read(outPath);
        const stderr = read(errPath);
        cleanup();
        resolve(resultFrom(error, stdout, stderr, timedOut));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const stdout = read(outPath);
        const stderr = read(errPath);
        cleanup();
        resolve({
          ok: code === 0,
          code: code ?? 1,
          stdout,
          stderr,
          output: `${stdout}${stderr}`.trim(),
          timedOut,
        });
      });
    });
  }

  /**
   * @param {string} file
   * @param {string[]} [args]
   * @param {{timeout?: number, cwd?: string}} [runOptions]
   * @returns {Promise<RunResult>}
   */
  async function run(file, args = [], runOptions = {}) {
    const { command, argv, verbatim } = resolveInvocation(file, args);
    try {
      return await runPiped(command, argv, runOptions, verbatim);
    } catch (error) {
      if (error && (error.code === 'EPERM' || error.code === 'ENOTSUP')) {
        return runFileBacked(command, argv, runOptions, verbatim);
      }
      return resultFrom(error, '', '');
    }
  }

  /**
   * Run with inherited stdio — used by `envup install`, where package managers
   * print progress bars and may need to prompt (sudo password).
   * @returns {Promise<number>} exit code
   */
  function runInteractive(file, args = [], runOptions = {}) {
    const { command, argv, verbatim } = resolveInvocation(file, args);
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(command, argv, {
          stdio: 'inherit',
          env,
          cwd: runOptions.cwd,
          windowsHide: false,
          windowsVerbatimArguments: verbatim,
        });
      } catch {
        resolve(1);
        return;
      }
      child.on('error', () => resolve(1));
      child.on('close', (code) => resolve(code ?? 1));
    });
  }

  return { run, runInteractive };
}
