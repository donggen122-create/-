import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STORY_SCENES, STORY_FACES, STORY_CHARACTERS } from '../game/src/story.data.js';
import { STAGES } from '../game/src/rework-core.js';

test('story has unique chapter 1-3 triggers, five lines each, and safe complete data', () => {
  assert.deepEqual(STORY_SCENES.map(s => [s.id, s.trigger.stage, s.trigger.when]), [
    ['ch1-start', 'CH01', 'before-start'], ['ch1-boss', 'CH05', 'before-start'], ['ch1-clear', 'CH05', 'after-clear'],
    ['ch2-start', 'CH06', 'before-start'], ['ch2-boss', 'CH10', 'before-start'], ['ch2-clear', 'CH10', 'after-clear'],
    ['ch3-start', 'CH11', 'before-start'], ['ch3-boss', 'CH15', 'before-start'], ['ch3-clear', 'CH15', 'after-clear'],
  ]);
  for (const scene of STORY_SCENES) {
    assert.ok(scene.title);
    assert.equal(scene.lines.length, 5);
    assert.ok(['before-start', 'after-clear'].includes(scene.trigger.when));
    for (const line of scene.lines) {
      assert.equal(typeof line.who, 'string');
      assert.equal(typeof line.text, 'string');
      assert.ok(line.text.length && line.who.length);
      assert.ok(Object.hasOwn(STORY_FACES, line.face));
      assert.equal(STORY_CHARACTERS[line.who]?.face, line.face);
      assert.ok(line.stage === undefined || typeof line.stage === 'string');
      assert.doesNotMatch(line.text, /죽[다었어음이]|사망|살해|머저리|건방/);
    }
  }
});

test('portraits exist, remain in story folder, and are transparent 160px PNGs', () => {
  for (const face of Object.values(STORY_FACES)) {
    assert.match(face, /^\.\/assets\/story\/[\w-]+\.png$/);
    const image = fs.readFileSync(new URL(`../game/${face}`, import.meta.url));
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    assert.equal(image.readUInt32BE(16), 160);
    assert.equal(image.readUInt32BE(20), 160);
    assert.equal(image[25], 6, 'RGBA PNG keeps transparency');
  }
});

test('all dialogue and stage one-liners retain the polished source wording', () => {
  const read = name => fs.readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
  const doc = read('44_학생_활동지_반영_준비.md');
  const polished = doc.slice(doc.indexOf('### 다듬은 초안'), doc.indexOf('### 게임에 넣는 방법')) + read('49_스토리_1-2장_다듬은_대본.md');
  for (const scene of STORY_SCENES) for (const line of scene.lines) {
    assert.ok(polished.includes(`${line.who}: ${line.stage ? `(${line.stage}) ` : ''}${line.text}`), `${scene.id}: ${line.who}: ${line.text}`);
  }
  for (const story of STAGES.filter(s => ['CH02', 'CH03', 'CH04', 'CH07', 'CH08', 'CH09'].includes(s.id)).map(s => s.story)) {
    assert.ok(polished.includes(`"${story}"`), story);
  }
  assert.deepEqual(STAGES.filter(s => ['CH12', 'CH13', 'CH14'].includes(s.id)).map(s => s.story), [
    '도전해 보자! 기름은 내가 닦을게.', '유령그물이다! 물고기를 풀어 주자.', '갈대숲은 내가 잘 알아. 따라와!',
  ]);
});
