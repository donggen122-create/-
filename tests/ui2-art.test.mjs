import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GuardianUI, icon, icon2 } from '../game/src/rework-ui.js';
import { UI2_ICONS, preloadUI2 } from '../game/src/ui2-art.js';
import { freshProfile, trainingCost, TRAINING_MAX } from '../game/src/rework-core.js';

function mode(value, fn) {
  const old = globalThis.document;
  globalThis.document = { documentElement: { classList: { contains: name => name === 'ui2' && value } } };
  try { fn(); } finally { if (old === undefined) delete globalThis.document; else globalThis.document = old; }
}
test('UI 1 keeps legacy SVG markup and does not preload UI 2 art', () => mode(false, () => {
  assert.equal(icon('coin'), '<img class="sg-icon " src="./assets/seoho_v1/icons/coin.svg" alt="" />');
  assert.equal(icon2('nav_training','mode_melee'), '<img class="sg-icon " src="./assets/elements_v2/icons/mode_melee.svg" alt="" />');
  let requests = 0; const old = globalThis.Image;
  globalThis.Image = class { set src(_) { requests++; } };
  try { preloadUI2(); assert.equal(requests, 0); } finally { if (old === undefined) delete globalThis.Image; else globalThis.Image = old; }
  assert.doesNotMatch(GuardianUI.prototype.training.call({ titleBar: () => '' }, freshProfile()), /ui2|sg-training-card/);
}));
test('UI 2 uses context-specific art and all 34 preload icons exist', () => mode(true, () => {
  assert.match(icon('element_earth'), /ui2\/icons\/el_earth\.png/);
  assert.match(icon('gift'), /cur_gift\.png/);
  assert.match(icon2('nav_training','mode_melee'), /nav_training\.png/);
  assert.equal(UI2_ICONS.length, 34);
  assert.equal(new Set(UI2_ICONS).size, 34);
  for (const name of UI2_ICONS) assert.ok(existsSync(new URL(`../game/assets/ui2/icons/${name}.png`, import.meta.url)), name);
}));
test('training still shows calculated cost and disables every unaffordable action', () => mode(true, () => {
  const p = freshProfile(); p.coins = 0; const html = GuardianUI.prototype.training.call({ titleBar: () => '' }, p);
  assert.equal((html.match(/data-action="train"/g) || []).length, 3);
  for (const id of ['attack','hp','speed']) {
    assert.match(html, new RegExp(`data-stat="${id}" disabled`));
    assert.ok(html.includes(`훈련하기 · ${trainingCost(p.training[id])} 코인`));
    assert.ok(html.includes(`stat_${id}.png`));
  }
}));
test('maximum training replaces the meters with three ribbons and keeps actions disabled', () => mode(true, () => {
  const p = freshProfile(); p.coins = 999999; p.training = { attack: TRAINING_MAX, hp: TRAINING_MAX, speed: TRAINING_MAX };
  const html = GuardianUI.prototype.training.call({ titleBar: () => '' }, p);
  assert.equal((html.match(/class="sg-training-max"/g) || []).length, 3);
  assert.equal((html.match(/disabled>최고 단계/g) || []).length, 3);
  assert.doesNotMatch(html, /role="meter"/);
}));
