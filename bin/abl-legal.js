#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const assetNames = ['consent.js', 'consent.css'];
const [command, ...args] = process.argv.slice(2);

try {
  if (command !== 'copy') {
    throw new Error(command ? `unknown command "${command}"` : 'missing command');
  }

  const { positionals } = parseArgs({ args, allowPositionals: true });
  if (positionals.length !== 1 || !positionals[0].trim()) {
    throw new Error('copy needs exactly one <public-dir>');
  }

  const destination = join(positionals[0], 'abl-legal');
  mkdirSync(destination, { recursive: true });

  for (const name of assetNames) {
    copyFileSync(new URL(`../assets/${name}`, import.meta.url), join(destination, name));
  }
} catch (error) {
  process.stderr.write(`abl-legal: ${error.message}\nUsage: abl-legal copy <public-dir>\n`);
  process.exitCode = 1;
}
