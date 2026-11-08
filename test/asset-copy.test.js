import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

test('checks asset bytes without changing missing or modified files', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'abl-legal-check-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const publicDirectory = join(directory, 'site public');
  const destination = join(publicDirectory, 'abl-legal');
  const copy = run('copy', publicDirectory);
  assert.equal(copy.status, 0, copy.stderr);
  const exact = run('check', publicDirectory);
  assert.equal(exact.status, 0, exact.stderr);

  const css = join(destination, 'consent.css');
  const differentBytes = Buffer.from([0, 255, 1]);
  writeFileSync(css, differentBytes);
  const mismatch = run('check', publicDirectory);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /consent\.css differs from the shipped asset/);
  assert.deepEqual(readFileSync(css), differentBytes);

  rmSync(css);
  const missing = run('check', publicDirectory);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /consent\.css/);
  assert.equal(existsSync(css), false);

  const absentPublicDirectory = join(directory, 'absent public');
  assert.equal(run('check', absentPublicDirectory).status, 1);
  assert.equal(existsSync(absentPublicDirectory), false);
});

test('rejects invalid commands and invalid asset arguments', () => {
  const invalid = [[], ['install'], ['copy'], ['copy', ''], ['copy', 'a', 'b'], ['copy', '--invalid'], ['check']];
  for (const args of invalid) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: abl-legal copy\|check <public-dir>/);
  }
});
