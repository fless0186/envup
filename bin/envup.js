#!/usr/bin/env node
import { main } from '../src/cli.js';

// Piping into `head` closes stdout early; that is not an error worth a stack.
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const code = await main();
process.exitCode = code;
