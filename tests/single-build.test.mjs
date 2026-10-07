import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('single-file modules include every local dependency before its importer', () => {
  const build = readFileSync(new URL('../game/tools/build-single.ps1', import.meta.url), 'utf8');
  const declaration = build.match(/^\$order = @\(([^\n]+)\)/m)?.[1];
  assert.ok(declaration, 'module order is declared');
  const order = [...declaration.matchAll(/"([\w.\-]+)"/g)].map(m => m[1]);
  assert.equal(order.length, new Set(order).size, 'no duplicate modules');
  assert.equal(order.at(-1), 'main');
  for (const [index, name] of order.entries()) {
    const src = readFileSync(new URL(`../game/src/${name}.js`, import.meta.url), 'utf8');
    for (const match of src.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]\.\/([\w.\-]+)\.js['"]/g)) {
      const dependency = match[1], position = order.indexOf(dependency);
      assert.ok(position >= 0 && position < index, `${name} needs ${dependency} first`);
    }
  }
});
