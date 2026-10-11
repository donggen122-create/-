import { assetURL } from './assets.js';
import { STORY_SCENES, STORY_FACES } from './story.data.js';

let active = null;
const resetAccounts = new Set();
const sessionSeen = new Set();

// Use the caller's existing account key rule; no account data lives in story data.
export function playStory(stage, when, storageKey) {
  const scenes = STORY_SCENES.filter(scene => scene.trigger.stage === stage && scene.trigger.when === when);
  return scenes.reduce((previous, scene) => previous.then(() => showStory(scene, storageKey)), Promise.resolve());
}

function showStory(scene, storageKey) {
  const query = new URLSearchParams(location.search);
  const key = storageKey(`story-seen:${scene.id}`);
  const accountKey = storageKey('story-seen:reset');
  if (query.get('story') === 'reset' && !resetAccounts.has(accountKey)) {
    for (const item of STORY_SCENES) {
      const seenKey = storageKey(`story-seen:${item.id}`);
      sessionSeen.delete(seenKey);
      try { localStorage.removeItem(seenKey); } catch { /* Storage can be disabled. */ }
    }
    resetAccounts.add(accountKey);
  }
  // Skipping QA must not mark a scene seen: an actual player can still see it later.
  if (navigator.webdriver === true && query.get('story') !== '1') return Promise.resolve();
  let seen = sessionSeen.has(key);
  try { seen ||= localStorage.getItem(key) === '1'; } catch { /* Session fallback below. */ }
  if (seen) return Promise.resolve();
  if (active) return active;

  const previousFocus = document.activeElement;
  const overlay = document.createElement('section');
  overlay.className = 'story-scene';
  overlay.dataset.scene = scene.id;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', scene.title);
  overlay.tabIndex = -1;
  overlay.innerHTML = '<button type="button" class="story-skip">건너뛰기</button><div class="story-box"><p class="story-title"></p><img class="story-face" alt="" width="160" height="160"><div class="story-speaker"><strong class="story-name"></strong><small class="story-stage"></small></div><p class="story-text" aria-live="polite"></p><button type="button" class="story-next">탭하면 다음 ▶</button></div>';
  const find = selector => overlay.querySelector(selector);
  find('.story-title').textContent = scene.title;
  let index = 0, speaker = null;
  const draw = () => {
    const line = scene.lines[index], face = find('.story-face');
    find('.story-name').textContent = line.who;
    find('.story-stage').textContent = line.stage ? `(${line.stage})` : '';
    find('.story-text').textContent = line.text;
    face.src = assetURL(STORY_FACES[line.face]);
    if (speaker !== line.face) {
      face.classList.remove('story-speaking');
      void face.offsetWidth;
      face.classList.add('story-speaking');
    }
    speaker = line.face;
    overlay.dataset.line = String(index);
  };
  let resolve;
  const completion = new Promise(done => { resolve = done; });
  active = completion;
  const finish = () => {
    sessionSeen.add(key);
    try { localStorage.setItem(key, '1'); } catch { /* Keep seen for this session. */ }
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    active = null;
    resolve();
  };
  const advance = () => { if (++index === scene.lines.length) finish(); else draw(); };
  const onKey = event => {
    event.stopImmediatePropagation();
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) document.activeElement === find('.story-skip') ? finish() : advance();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === find('.story-skip') ? find('.story-next') : find('.story-skip')).focus();
    }
  };
  const onKeyUp = event => { event.stopImmediatePropagation(); };
  overlay.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target.closest('.story-skip')) finish(); else advance();
  });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  document.body.append(overlay);
  draw();
  overlay.focus({ preventScroll: true });
  return completion;
}
