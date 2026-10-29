import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Create a throwaway directory that the caller is expected to clean up. */
export function tempDir(prefix = 'envup-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Write a file, creating parent directories. */
export function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Write a JSON file. */
export function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Create an executable-looking file inside `dir`.
 * The tests never execute it — they inject a fake runner — so an empty file
 * with the right name and extension is enough on every platform.
 */
export function fakeExecutable(dir, name, { extension = process.platform === 'win32' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, extension && !path.extname(name) ? `${name}.exe` : name);
  fs.writeFileSync(file, '');
  if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
  return file;
}

/** Build a PATH-like string from directories. */
export function pathString(...dirs) {
  return dirs.join(path.delimiter);
}

/** Remove a temp tree without failing the test when it is already gone. */
export function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * A runner stub: maps executable basenames to the version output they print.
 * Unknown binaries look like a normal "command not found".
 *
 * @param {Record<string, string>} versions
 */
export function stubRunner(versions = {}) {
  return {
    calls: [],
    async run(file, args = []) {
      this.calls.push({ file, args });
      const base = path.basename(file).replace(/\.(exe|cmd|bat)$/i, '');
      const output = versions[base];
      if (output === undefined) {
        return { ok: false, code: 127, stdout: '', stderr: 'not found', output: 'not found', timedOut: false };
      }
      return { ok: true, code: 0, stdout: output, stderr: '', output, timedOut: false };
    },
    async runInteractive() {
      return 0;
    },
  };
}
