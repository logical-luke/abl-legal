import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/abl-legal.js', import.meta.url));
const assetNames = ['consent.js', 'consent.css'];

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('copies the shipped assets exactly into a public path with spaces', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'abl-legal-copy-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const publicDirectory = join(directory, 'site public');
  const destination = join(publicDirectory, 'abl-legal');
  const unrelatedFile = join(destination, 'site.css');
  mkdirSync(destination, { recursive: true });
  writeFileSync(unrelatedFile, 'keep this file');
  writeFileSync(join(destination, 'consent.js'), 'old asset');

  const result = run('copy', publicDirectory);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(destination).sort(), [...assetNames, 'site.css'].sort());
  for (const name of assetNames) {
    const source = new URL(`../assets/${name}`, import.meta.url);
    assert.deepEqual(readFileSync(join(destination, name)), readFileSync(source));
  }
  assert.equal(readFileSync(unrelatedFile, 'utf8'), 'keep this file');
});

test('rejects invalid commands and invalid copy arguments', () => {
  for (const args of [[], ['install'], ['copy'], ['copy', ''], ['copy', 'a', 'b'], ['copy', '--invalid']]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: abl-legal copy <public-dir>/);
  }
});
