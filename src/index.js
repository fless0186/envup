/**
 * Programmatic API.
 *
 * ```js
 * import { checkEnvironment } from 'envup';
 *
 * const { summary, results } = await checkEnvironment({ dir: process.cwd() });
 * ```
 */
export { checkEnvironment, checkExitCode, toJson } from './core/check.js';
export { loadManifest, parseManifest, MANIFEST_FILENAME } from './core/manifest.js';
export { detectTool } from './core/detect.js';
export { planInstall } from './core/installs.js';
export { detectManagers } from './core/platform.js';
export { scanProject } from './core/project.js';
export { getTool, toolIds, TOOLS } from './core/registry.js';
export { satisfies, isValidRange, parseRange, parseVersion } from './core/semver.js';
export { createRunner } from './core/runner.js';
