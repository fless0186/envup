/**
 * Errors that should be shown to the user without a stack trace.
 */
export class EnvupError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, hint?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'EnvupError';
    this.code = options.code ?? 'E_ENVUP';
    this.hint = options.hint ?? '';
  }
}
