#!/usr/bin/env node
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const assetNames = ['consent.js', 'consent.css'];
const [command, ...args] = process.argv.slice(2);

try {
  if (command !== 'copy' && command !== 'check') {
    throw new Error(command ? `unknown command "${command}"` : 'missing command');
  }

  const { positionals } = parseArgs({ args, allowPositionals: true });
  if (positionals.length !== 1 || !positionals[0].trim()) {
    throw new Error(`${command} needs exactly one <public-dir>`);
  }

  const destination = join(positionals[0], 'abl-legal');
  if (command === 'copy') mkdirSync(destination, { recursive: true });

  for (const name of assetNames) {
    const source = new URL(`../assets/${name}`, import.meta.url);
    const target = join(destination, name);
    if (command === 'copy') {
      copyFileSync(source, target);
    } else if (!readFileSync(source).equals(readFileSync(target))) {
      throw new Error(`${target} differs from the shipped asset. Run abl-legal copy <public-dir>.`);
    }
  }
} catch (error) {
  process.stderr.write(`abl-legal: ${error.message}\nUsage: abl-legal copy|check <public-dir>\n`);
  process.exitCode = 1;
}
