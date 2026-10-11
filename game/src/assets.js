// 에셋 매니페스트 — 콘텐츠 ID와 실제 파일을 한곳에서 연결한다.
// 출처는 ASSET_CREDITS.md 참조. 이미지 크기(16x16 원본)와 게임 내 표시/충돌 크기는 분리되어 있으며,
// 표시 크기는 content.js의 각 정의(radiusU 등)가, 확대 배율은 아래 DRAW_SCALE이 담당한다.

export const ASSET_VERSION = "20261012d1";
export const IMAGE_FORMAT_EXCEPTIONS = {
  "assets/sprites/floor_ground.webp": "assets/sprites/floor_ground.png",
  "assets/sprites/gear/gear_hoya_melee_armor.webp": "assets/sprites/gear/gear_hoya_melee_armor.png",
  "assets/sprites/gear/gear_hoya_melee_gloves.webp": "assets/sprites/gear/gear_hoya_melee_gloves.png",
  "assets/sprites/gear/gear_hoya_melee_helm.webp": "assets/sprites/gear/gear_hoya_melee_helm.png",
  "assets/sprites/gear/gear_hoya_melee_necklace.webp": "assets/sprites/gear/gear_hoya_melee_necklace.png",
  "assets/sprites/gear/gear_hoya_melee_shoes.webp": "assets/sprites/gear/gear_hoya_melee_shoes.png",
  "assets/sprites/gear/gear_hoya_ranged_armor.webp": "assets/sprites/gear/gear_hoya_ranged_armor.png",
  "assets/sprites/gear/gear_hoya_ranged_gloves.webp": "assets/sprites/gear/gear_hoya_ranged_gloves.png",
  "assets/sprites/gear/gear_hoya_ranged_helm.webp": "assets/sprites/gear/gear_hoya_ranged_helm.png",
  "assets/sprites/gear/gear_hoya_ranged_necklace.webp": "assets/sprites/gear/gear_hoya_ranged_necklace.png",
  "assets/sprites/gear/gear_hoya_ranged_shoes.webp": "assets/sprites/gear/gear_hoya_ranged_shoes.png",
  "assets/sprites/gear/gear_hoya_ranged_weapon.webp": "assets/sprites/gear/gear_hoya_ranged_weapon.png",
  "assets/sprites/gear/gear_minji_melee_armor.webp": "assets/sprites/gear/gear_minji_melee_armor.png",
  "assets/sprites/gear/gear_minji_melee_gloves.webp": "assets/sprites/gear/gear_minji_melee_gloves.png",
  "assets/sprites/gear/gear_minji_melee_helm.webp": "assets/sprites/gear/gear_minji_melee_helm.png",
  "assets/sprites/gear/gear_minji_melee_necklace.webp": "assets/sprites/gear/gear_minji_melee_necklace.png",
  "assets/sprites/gear/gear_minji_melee_shoes.webp": "assets/sprites/gear/gear_minji_melee_shoes.png",
  "assets/sprites/gear/gear_minji_melee_weapon.webp": "assets/sprites/gear/gear_minji_melee_weapon.png",
  "assets/sprites/gear/gear_minji_ranged_armor.webp": "assets/sprites/gear/gear_minji_ranged_armor.png",
  "assets/sprites/gear/gear_minji_ranged_gloves.webp": "assets/sprites/gear/gear_minji_ranged_gloves.png",
  "assets/sprites/gear/gear_minji_ranged_helm.webp": "assets/sprites/gear/gear_minji_ranged_helm.png",
  "assets/sprites/gear/gear_minji_ranged_necklace.webp": "assets/sprites/gear/gear_minji_ranged_necklace.png",
  "assets/sprites/gear/gear_minji_ranged_shoes.webp": "assets/sprites/gear/gear_minji_ranged_shoes.png",
  "assets/sprites/gear/gear_minji_ranged_weapon.webp": "assets/sprites/gear/gear_minji_ranged_weapon.png",
  "assets/sprites/heroes/hoya_attack_2.webp": "assets/sprites/heroes/hoya_attack_2.png",
  "assets/sprites/skills/fire_fwork_1.webp": "assets/sprites/skills/fire_fwork_1.png",
  "assets/sprites/skills/water_spray_2.webp": "assets/sprites/skills/water_spray_2.png",
  "assets/sprites/t1/item_heart.webp": "assets/sprites/t1/item_heart.png",
  "assets/sprites/t1/item_recycle.webp": "assets/sprites/t1/item_recycle.png",
  "assets/sprites/t1/item_sprout.webp": "assets/sprites/t1/item_sprout.png",
  "assets/sprites/t1/item_sprout_big.webp": "assets/sprites/t1/item_sprout_big.png",
  "assets/sprites/t1/item_star.webp": "assets/sprites/t1/item_star.png",
  "assets/sprites/t2/card_clean.webp": "assets/sprites/t2/card_clean.jpg",
  "assets/sprites/t2/card_polluted.webp": "assets/sprites/t2/card_polluted.jpg",
  "assets/sprites/t3/card_clean.webp": "assets/sprites/t3/card_clean.jpg",
  "assets/sprites/t3/card_polluted.webp": "assets/sprites/t3/card_polluted.jpg",
  "assets/sprites/t4/card_clean.webp": "assets/sprites/t4/card_clean.jpg",
  "assets/sprites/t4/card_polluted.webp": "assets/sprites/t4/card_polluted.jpg",
  "assets/sprites/t4/fx_flames.webp": "assets/sprites/t4/fx_flames.png",
  "assets/sprites/t4/fx_trashball.webp": "assets/sprites/t4/fx_trashball.png",
  "assets/sprites/t4/prop_ember.webp": "assets/sprites/t4/prop_ember.png",
  "assets/sprites/t4/prop_sprout.webp": "assets/sprites/t4/prop_sprout.png",
  "assets/sprites/ui/supply_gear_closed.webp": "assets/sprites/ui/supply_gear_closed.png",
  "assets/sprites/ui/supply_gear_lid.webp": "assets/sprites/ui/supply_gear_lid.png",
  "assets/sprites/ui/supply_gear_open.webp": "assets/sprites/ui/supply_gear_open.png",
  "assets/sprites/ui/supply_part_closed.webp": "assets/sprites/ui/supply_part_closed.png",
  "assets/sprites/ui/supply_part_lid.webp": "assets/sprites/ui/supply_part_lid.png",
  "assets/sprites/ui/supply_part_open.webp": "assets/sprites/ui/supply_part_open.png",
  "assets/ui/notice_ch4.webp": "assets/ui/notice_ch4.jpg",
  "assets/ui/title_landscape.webp": "assets/ui/title_landscape.jpg",
  "assets/ui/title_portrait.webp": "assets/ui/title_portrait.jpg",
  "assets/ui2/bg_hq.webp": "assets/ui2/bg_hq.jpg",
  "assets/ui2/icons/hud_weapon_ranged.webp": "assets/ui2/icons/hud_weapon_ranged.png"
};
export function assetURL(src) {
  if (!src || !/(?:^|\/)assets\//.test(src) || /^(data:|blob:)/.test(src)) return src;
  const path = src.split(/[?#]/)[0];
  const retained = IMAGE_FORMAT_EXCEPTIONS[path.replace(/^\.\//, '')];
  if (retained) src = src.replace(path, (path.startsWith('./') ? './' : '') + retained);
  const [base, hash] = src.split('#');
  const url = base.replace(/([?&])v=[^&#]*/g, '$1').replace(/[?&]$/, '');
  return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VERSION + (hash ? '#' + hash : '');
}
// Covers the unchanged effects module too; only asset image URLs are rewritten.
if (typeof HTMLImageElement !== 'undefined') {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {...descriptor,
    set(value) { descriptor.set.call(this, assetURL(String(value))); }
  });
}
const IMG_BASE = "./assets/sprites/";
const AUDIO_BASE = "./assets/audio/";
const UI_BASE = "./assets/ui/";

export const ELEMENT_WEAPONS=Object.fromEntries(['sword','pencil','bat','dodgeball','baseball'].map(id=>{
  const img=typeof Image==='undefined'?{}:new Image();img.assetSource=`./assets/elements_v2/weapons/${id}.webp`;
  // Find transparent padding once so the hand anchor is independent of generator canvas size.
  img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const data=g.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>40){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r>=l)img.assetBounds={x:l,y:t,w:r-l+1,h:b-t+1};};
  return [id,img];
}));

export const SPRITE_FILES = {
  vfx_purify: IMG_BASE + "vfx/purify-v1.webp",
  vfx_smog: IMG_BASE + "vfx/smog-v1.webp",
  vfx_splash: IMG_BASE + "vfx/splash-v1.webp",
  player_knight: IMG_BASE + "player_knight.webp",
  enemy_wraith: IMG_BASE + "enemy_wraith.webp",
  enemy_spider: IMG_BASE + "enemy_spider.webp",
  enemy_elite: IMG_BASE + "enemy_elite.webp",
  prop_torch: IMG_BASE + "prop_torch.webp",
  prop_rock: IMG_BASE + "prop_rock.webp",
  prop_chest: IMG_BASE + "prop_chest.webp",
  floor_ground: IMG_BASE + "floor_ground.png",
  // 환경 테마 1 「쓰레기 마을」 — 이미지 에셋/테마 1단계 *.jpg 등(Gemini) → tools/cut_theme1.py. 바닥 3종은 448px 이어 붙는 타일
  t1_floor_dirt: IMG_BASE + "t1/floor_dirt.webp",
  t1_floor_concrete: IMG_BASE + "t1/floor_concrete.webp",
  t1_floor_trash: IMG_BASE + "t1/floor_trash.webp",
  t1_prop_bins: IMG_BASE + "t1/prop_bins.webp",              // 분리수거함 = 정화 장치(안전 구역)
  t1_prop_bin_fallen: IMG_BASE + "t1/prop_bin_fallen.webp",
  t1_prop_bags: IMG_BASE + "t1/prop_bags.webp",
  t1_prop_tire: IMG_BASE + "t1/prop_tire.webp",
  t1_prop_bench: IMG_BASE + "t1/prop_bench.webp",
  t1_prop_litter: IMG_BASE + "t1/prop_litter.webp",
  t1_en_snackbag: IMG_BASE + "t1/en_snackbag.webp",
  t1_en_buttbug: IMG_BASE + "t1/en_buttbug.webp",
  t1_en_bottle: IMG_BASE + "t1/en_bottle.webp",
  t1_en_baggy: IMG_BASE + "t1/en_baggy.webp",
  t1_en_foodwaste: IMG_BASE + "t1/en_foodwaste.webp",
  t1_en_fly: IMG_BASE + "t1/en_fly.webp",
  t1_boss_calm: IMG_BASE + "t1/boss_calm.webp",
  t1_boss_angry: IMG_BASE + "t1/boss_angry.webp",
  // 대왕 기술 효과(사용자 Gemini 2026-09-23, game/tools/cut_boss_fx.py): 던지는 쓰레기 뭉치 · 쾅 충격파 고리 · 금 간 땅
  t1_fx_trashball: IMG_BASE + "t1/fx_trashball.webp",
  t1_fx_shockring: IMG_BASE + "t1/fx_shockring.webp",
  t1_fx_crack: IMG_BASE + "t1/fx_crack.webp",
  // 테마 2 「대기오염 공장 지대」(사용자 Gemini 2026-09-24, game/tools/cut_theme2.py)
  t2_en_dust: IMG_BASE + "t2/en_dust.webp",
  t2_en_gas: IMG_BASE + "t2/en_gas.webp",
  t2_en_gas_fire: IMG_BASE + "t2/en_gas_fire.webp",
  t2_en_gas_windup: IMG_BASE + "t2/en_gas_windup.webp",
  t2_en_germ: IMG_BASE + "t2/en_germ.webp",
  t2_en_germ2: IMG_BASE + "t2/en_germ2.webp",
  t2_en_germ3: IMG_BASE + "t2/en_germ3.webp",
  t2_en_germ_armed: IMG_BASE + "t2/en_germ_armed.webp",
  t2_en_raincloud: IMG_BASE + "t2/en_raincloud.webp",
  t2_en_bigdust: IMG_BASE + "t2/en_bigdust.webp",
  t2_boss_calm: IMG_BASE + "t2/boss_calm.webp",
  t2_boss_angry: IMG_BASE + "t2/boss_angry.webp",
  t2_prop_tree: IMG_BASE + "t2/prop_tree.webp",
  t2_prop_drums: IMG_BASE + "t2/prop_drums.webp",
  t2_prop_pipe: IMG_BASE + "t2/prop_pipe.webp",
  t2_prop_chimney: IMG_BASE + "t2/prop_chimney.webp",
  t2_prop_cones: IMG_BASE + "t2/prop_cones.webp",
  t2_prop_pedestal: IMG_BASE + "t2/prop_pedestal.webp",
  t2_prop_valve: IMG_BASE + "t2/prop_valve.webp",
  t2_fx_flame: IMG_BASE + "t2/fx_flame.webp",
  t2_fx_smog: IMG_BASE + "t2/fx_smog.webp",
  t2_fx_bomb: IMG_BASE + "t2/fx_bomb.webp",
  t2_fx_splat: IMG_BASE + "t2/fx_splat.webp",
  t2_floor_factory: IMG_BASE + "t2/floor_factory.webp",
  t2_floor_steel: IMG_BASE + "t2/floor_steel.webp",
  t2_floor_soot: IMG_BASE + "t2/floor_soot.webp",
  // 테마 3 「오염된 하천」(2026-09-30, Antigravity 6장 + 사용자 Gemini 바닥·마을 카드, game/tools/cut_theme3.py)
  t3_en_bubble: IMG_BASE + "t3/en_bubble.webp",
  t3_en_bubble_atk: IMG_BASE + "t3/en_bubble_atk.webp",
  t3_en_petri: IMG_BASE + "t3/en_petri.webp",
  t3_en_petri_windup: IMG_BASE + "t3/en_petri_windup.webp",
  t3_en_petri_fire: IMG_BASE + "t3/en_petri_fire.webp",
  t3_en_can: IMG_BASE + "t3/en_can.webp",
  t3_en_can_fire: IMG_BASE + "t3/en_can_fire.webp",
  t3_en_netmon: IMG_BASE + "t3/en_netmon.webp",
  t3_en_netmon_pounce: IMG_BASE + "t3/en_netmon_pounce.webp",
  t3_en_net: IMG_BASE + "t3/en_net.webp",
  t3_en_net_throw: IMG_BASE + "t3/en_net_throw.webp",
  t3_boss_calm: IMG_BASE + "t3/boss_calm.webp",
  t3_boss_angry: IMG_BASE + "t3/boss_angry.webp",
  t3_prop_reeds: IMG_BASE + "t3/prop_reeds.webp",
  t3_prop_stones: IMG_BASE + "t3/prop_stones.webp",
  t3_prop_rock: IMG_BASE + "t3/prop_rock.webp",
  t3_prop_trash: IMG_BASE + "t3/prop_trash.webp",
  t3_prop_fish_caught: IMG_BASE + "t3/prop_fish_caught.webp",
  t3_prop_fish_free: IMG_BASE + "t3/prop_fish_free.webp",
  t3_fx_wave: IMG_BASE + "t3/fx_wave.webp",
  t3_fx_oil: IMG_BASE + "t3/fx_oil.webp",
  t3_fx_foam: IMG_BASE + "t3/fx_foam.webp",
  t3_fx_cola: IMG_BASE + "t3/fx_cola.webp",
  t3_fx_net: IMG_BASE + "t3/fx_net.webp",
  t3_floor_stream: IMG_BASE + "t3/floor_stream.webp",
  t3_floor_bank: IMG_BASE + "t3/floor_bank.webp",
  t3_floor_sewer: IMG_BASE + "t3/floor_sewer.webp",
  // 테마 4 「불타는 숲」(2026-10-07, 사용자 Codex 그림 11장, game/tools/cut_theme4.py). card_*.jpg는 로비(rework.css)만 쓴다
  t4_boss_angry: IMG_BASE + "t4/boss_angry.webp",
  t4_boss_calm: IMG_BASE + "t4/boss_calm.webp",
  t4_boss_clean: IMG_BASE + "t4/boss_clean.webp",
  t4_boss_slam: IMG_BASE + "t4/boss_slam.webp",
  t4_en_bulki: IMG_BASE + "t4/en_bulki.webp",
  t4_en_bulki_jump: IMG_BASE + "t4/en_bulki_jump.webp",
  t4_en_bulki_throw: IMG_BASE + "t4/en_bulki_throw.webp",
  t4_en_burner: IMG_BASE + "t4/en_burner.webp",
  t4_en_burner_big: IMG_BASE + "t4/en_burner_big.webp",
  t4_en_burner_l: IMG_BASE + "t4/en_burner_l.webp",
  t4_en_burner_m: IMG_BASE + "t4/en_burner_m.webp",
  t4_en_burner_out: IMG_BASE + "t4/en_burner_out.webp",
  t4_en_burner_s: IMG_BASE + "t4/en_burner_s.webp",
  t4_en_dozer: IMG_BASE + "t4/en_dozer.webp",
  t4_en_dozer_charge: IMG_BASE + "t4/en_dozer_charge.webp",
  t4_en_nutria: IMG_BASE + "t4/en_nutria.webp",
  t4_en_nutria_guard: IMG_BASE + "t4/en_nutria_guard.webp",
  t4_en_saw: IMG_BASE + "t4/en_saw.webp",
  t4_en_saw_spin: IMG_BASE + "t4/en_saw_spin.webp",
  t4_floor_burnt: IMG_BASE + "t4/floor_burnt.webp",
  t4_floor_logging: IMG_BASE + "t4/floor_logging.webp",
  t4_floor_trail: IMG_BASE + "t4/floor_trail.webp",
  t4_fx_dust: IMG_BASE + "t4/fx_dust.webp",
  t4_fx_flames: IMG_BASE + "t4/fx_flames.png",
  t4_fx_puff: IMG_BASE + "t4/fx_puff.webp",
  t4_fx_slam: IMG_BASE + "t4/fx_slam.webp",
  t4_fx_tracks: IMG_BASE + "t4/fx_tracks.webp",
  t4_fx_trashball: IMG_BASE + "t4/fx_trashball.png",
  t4_prop_burnt: IMG_BASE + "t4/prop_burnt.webp",
  t4_prop_camptrash: IMG_BASE + "t4/prop_camptrash.webp",
  t4_prop_ember: IMG_BASE + "t4/prop_ember.png",
  t4_prop_pond: IMG_BASE + "t4/prop_pond.webp",
  t4_prop_sprout: IMG_BASE + "t4/prop_sprout.png",
  t4_prop_stump: IMG_BASE + "t4/prop_stump.webp",
  // 공용 아이템(모든 테마): 새싹(경험치) · 큰 새싹 · 재활용 봉투(보물) · 하트 · 지구 에너지 구슬 · 별가루
  item_sprout: IMG_BASE + "t1/item_sprout.png",
  item_sprout_big: IMG_BASE + "t1/item_sprout_big.png",
  item_recycle: IMG_BASE + "t1/item_recycle.png",
  item_heart: IMG_BASE + "t1/item_heart.png",
  item_orb: IMG_BASE + "t1/item_orb.webp",
  item_star: IMG_BASE + "t1/item_star.png",
};

// 주인공 2종(호야·민지) 프레임 애니메이션. 원본: 이미지 에셋/*.png(Gemini 앱 생성) → tools/cut_heroes.py로 잘라낸
// 128px 높이 투명 PNG. 모두 오른쪽을 보는 옆모습이며 발바닥 기준선이 맞춰져 있다(왼쪽 이동은 좌우 반전).
// 경로는 단일 파일 빌드(tools/build-single.ps1)가 문자열째로 data URI로 바꾸므로 반드시 리터럴로 적는다.
export const HERO_FILES = {
  hoya: {
    idle: [IMG_BASE + "heroes/hoya_idle_1.webp"],
    walk: [IMG_BASE + "heroes/hoya_walk_1.webp", IMG_BASE + "heroes/hoya_walk_2.webp", IMG_BASE + "heroes/hoya_walk_3.webp"],
    run: [IMG_BASE + "heroes/hoya_run_1.webp", IMG_BASE + "heroes/hoya_run_2.webp", IMG_BASE + "heroes/hoya_run_3.webp"],
    jump: [IMG_BASE + "heroes/hoya_jump_1.webp", IMG_BASE + "heroes/hoya_jump_2.webp"],
    attack: [IMG_BASE + "heroes/hoya_attack_1.webp", IMG_BASE + "heroes/hoya_attack_2.png", IMG_BASE + "heroes/hoya_attack_3.webp"],
    hurt: [IMG_BASE + "heroes/hoya_hurt_1.webp"],
    down: [IMG_BASE + "heroes/hoya_down_1.webp"],
    // 원거리(야구방망이) 모드 전용 — 사용자 Gemini 시트 → tools/cut_heroes_bat.py. 없으면 위 프레임으로 대신함
    ranged: [IMG_BASE + "heroes/hoya_ranged_1.webp", IMG_BASE + "heroes/hoya_ranged_2.webp", IMG_BASE + "heroes/hoya_ranged_3.webp", IMG_BASE + "heroes/hoya_ranged_4.webp", IMG_BASE + "heroes/hoya_ranged_5.webp", IMG_BASE + "heroes/hoya_ranged_6.webp"],
    rangedIdle: [IMG_BASE + "heroes/hoya_ranged_idle_1.webp"],
    rangedWalk: [IMG_BASE + "heroes/hoya_ranged_walk_1.webp", IMG_BASE + "heroes/hoya_ranged_walk_2.webp", IMG_BASE + "heroes/hoya_ranged_walk_3.webp"],
    rangedRun: [IMG_BASE + "heroes/hoya_ranged_run_1.webp", IMG_BASE + "heroes/hoya_ranged_run_2.webp", IMG_BASE + "heroes/hoya_ranged_run_3.webp"],
    rangedJump: [IMG_BASE + "heroes/hoya_ranged_jump_1.webp", IMG_BASE + "heroes/hoya_ranged_jump_2.webp"],
    rangedHurt: [IMG_BASE + "heroes/hoya_ranged_hurt_1.webp"],
    rangedDown: [IMG_BASE + "heroes/hoya_ranged_down_1.webp"],
  },
  minji: {
    idle: [IMG_BASE + "heroes/minji_idle_1.webp"],
    walk: [IMG_BASE + "heroes/minji_walk_1.webp", IMG_BASE + "heroes/minji_walk_2.webp", IMG_BASE + "heroes/minji_walk_3.webp"],
    run: [IMG_BASE + "heroes/minji_run_1.webp", IMG_BASE + "heroes/minji_run_2.webp", IMG_BASE + "heroes/minji_run_3.webp"],
    jump: [IMG_BASE + "heroes/minji_jump_1.webp"],
    attack: [IMG_BASE + "heroes/minji_attack_1.webp", IMG_BASE + "heroes/minji_attack_2.webp", IMG_BASE + "heroes/minji_attack_3.webp"],
    hurt: [IMG_BASE + "heroes/minji_hurt_1.webp"],
    down: [IMG_BASE + "heroes/minji_down_1.webp"],
    // 원거리(피구공 던지기) 모드 전용 — 사용자 Gemini 시트(전투 시트만 있어 걷기·달리기는 원본 그대로)
    ranged: [IMG_BASE + "heroes/minji_ranged_1.webp", IMG_BASE + "heroes/minji_ranged_2.webp", IMG_BASE + "heroes/minji_ranged_3.webp", IMG_BASE + "heroes/minji_ranged_4.webp", IMG_BASE + "heroes/minji_ranged_5.webp", IMG_BASE + "heroes/minji_ranged_6.webp"],
    rangedIdle: [IMG_BASE + "heroes/minji_ranged_idle_1.webp"],
    rangedHurt: [IMG_BASE + "heroes/minji_ranged_hurt_1.webp"],
    rangedDown: [IMG_BASE + "heroes/minji_ranged_down_1.webp"],
  },
};
export const HERO_INFO = {
  hoya: { id: "hoya", name: "호야", desc: "파란 후드티와 장난감 칼. 씩씩한 남자아이" },
  minji: { id: "minji", name: "민지", desc: "분홍 가디건과 마법 색연필. 밝은 여자아이" },
};

export const UI_FILES = {
  panelBorder: UI_BASE + "panel-border.webp",
  panelBorderThin: UI_BASE + "panel-border-thin.webp",
};

export const SFX_FILES = {
  attackFire: AUDIO_BASE + "attack_whoosh.ogg",
  hitLight: AUDIO_BASE + "hit_light.ogg",
  hitLight2: AUDIO_BASE + "hit_light2.ogg",
  hitBoss: AUDIO_BASE + "hit_boss.ogg",
  gemPickup: AUDIO_BASE + "gem_pickup.ogg",
  goldReward: AUDIO_BASE + "gold_reward.ogg",
  bossTelegraph: AUDIO_BASE + "boss_telegraph.ogg",
  levelupOpen: AUDIO_BASE + "levelup_open.ogg",
  cardSelect: AUDIO_BASE + "card_select.ogg",
  uiClick: AUDIO_BASE + "ui_click.ogg",
};

export const CHAPTER_SPRITE_KEYS = Object.fromEntries([1,2,3,4].map(n => [n,
  Object.keys(SPRITE_FILES).filter(k => k.startsWith(`t${n}_`))
    .concat(n === 3 ? ['t1_fx_trashball'] : [])]));
export const COMMON_SPRITE_KEYS = Object.keys(SPRITE_FILES).filter(k => !/^t[1-4]_/.test(k));
// Generated names are checked against the actual effect files in tests.
export const ELEMENT_SKILL_NAMES = ["earth_bigdirt_1", "earth_bigdirt_2", "earth_boulder_1", "earth_boulder_2", "earth_chain_ring", "earth_crack", "earth_dirt_1", "earth_dirt_2", "earth_dust_1", "earth_dust_2", "earth_dust_trail", "earth_mole_1", "earth_mole_2", "earth_molefield", "earth_stone_1", "earth_stone_2", "fire_boom_1", "fire_boom_2", "fire_boom_3", "fire_bottle", "fire_frocket", "fire_fwork_1", "fire_fwork_2", "fire_fwork_3", "fire_lava_1", "fire_lava_2", "fire_lava_3", "fire_puddle_1", "fire_puddle_2", "fire_puddle_3", "fire_rocket", "fire_volcano", "lightning_bee_1", "lightning_bee_2", "lightning_bigburst", "lightning_bigflash", "lightning_bolt_1", "lightning_bolt_2", "lightning_cloud", "lightning_flash", "lightning_hline", "lightning_hstinger", "lightning_spark", "lightning_stinger", "lightning_storm", "lightning_swarm", "lightning_tbolt_1", "lightning_tbolt_2", "support_S1", "support_S2", "support_S3", "support_S4", "support_S5", "support_S6", "support_S7", "support_S8", "water_balloon", "water_beam", "water_beam_tip", "water_kballoon", "water_ksplash_1", "water_ksplash_2", "water_ksplash_3", "water_rbeam", "water_rbeam_tip", "water_rspray_1", "water_rspray_2", "water_splash_1", "water_splash_2", "water_splash_3", "water_spray_1", "water_spray_2", "wind_boomerang_1", "wind_boomerang_2", "wind_burst", "wind_mboomerang_1", "wind_mboomerang_2", "wind_pull_line", "wind_ring", "wind_shadow", "wind_swirl", "wind_top_1", "wind_top_2", "wind_top_3", "wind_trail", "wind_typhoon_1", "wind_typhoon_2", "wind_typhoon_3"];
export const UI2_SKILL_NAMES = ["earth_boulder_1", "earth_mole_1", "earth_molefield", "earth_stone_1", "fire_bottle", "fire_frocket", "fire_rocket", "fire_volcano", "lightning_bee_1", "lightning_cloud", "lightning_storm", "lightning_swarm", "support_S1", "support_S2", "support_S3", "support_S4", "support_S5", "support_S6", "support_S7", "support_S8", "water_balloon", "water_beam_tip", "water_kballoon", "water_rbeam_tip", "wind_boomerang_1", "wind_mboomerang_1", "wind_top_1", "wind_typhoon_1"];
export const COMMON_ICON_FILES = ["./assets/seoho_v1/icons/arrow.svg", "./assets/seoho_v1/icons/book.svg", "./assets/seoho_v1/icons/boots.svg", "./assets/seoho_v1/icons/broom.svg", "./assets/seoho_v1/icons/coin.svg", "./assets/seoho_v1/icons/gift.svg", "./assets/seoho_v1/icons/grabber.svg", "./assets/seoho_v1/icons/handle.svg", "./assets/seoho_v1/icons/heart.svg", "./assets/seoho_v1/icons/map.svg", "./assets/seoho_v1/icons/pass.svg", "./assets/seoho_v1/icons/pinwheel.svg", "./assets/seoho_v1/icons/seed.svg", "./assets/seoho_v1/icons/shield.svg", "./assets/seoho_v1/icons/shirt.svg", "./assets/seoho_v1/icons/spark.svg", "./assets/seoho_v1/icons/sun.svg", "./assets/seoho_v1/icons/water.svg", "./assets/seoho_v1/icons/watergun.svg", "./assets/seoho_v1/icons/wind.svg", "./assets/elements_v2/icons/combo_COMBO_01.svg", "./assets/elements_v2/icons/combo_COMBO_02.svg", "./assets/elements_v2/icons/combo_COMBO_03.svg", "./assets/elements_v2/icons/combo_COMBO_04.svg", "./assets/elements_v2/icons/combo_COMBO_05.svg", "./assets/elements_v2/icons/combo_COMBO_06.svg", "./assets/elements_v2/icons/combo_COMBO_07.svg", "./assets/elements_v2/icons/combo_COMBO_08.svg", "./assets/elements_v2/icons/combo_COMBO_09.svg", "./assets/elements_v2/icons/combo_COMBO_10.svg", "./assets/elements_v2/icons/combo_COMBO_11.svg", "./assets/elements_v2/icons/combo_COMBO_12.svg", "./assets/elements_v2/icons/combo_COMBO_13.svg", "./assets/elements_v2/icons/combo_COMBO_14.svg", "./assets/elements_v2/icons/combo_COMBO_15.svg", "./assets/elements_v2/icons/element_earth.svg", "./assets/elements_v2/icons/element_fire.svg", "./assets/elements_v2/icons/element_lightning.svg", "./assets/elements_v2/icons/element_water.svg", "./assets/elements_v2/icons/element_wind.svg", "./assets/elements_v2/icons/mode_melee.svg", "./assets/elements_v2/icons/mode_ranged.svg", "./assets/elements_v2/icons/part_PART_E1.svg", "./assets/elements_v2/icons/part_PART_E2.svg", "./assets/elements_v2/icons/part_PART_E3.svg", "./assets/elements_v2/icons/part_PART_F1.svg", "./assets/elements_v2/icons/part_PART_F2.svg", "./assets/elements_v2/icons/part_PART_F3.svg", "./assets/elements_v2/icons/part_PART_L1.svg", "./assets/elements_v2/icons/part_PART_L2.svg", "./assets/elements_v2/icons/part_PART_L3.svg", "./assets/elements_v2/icons/part_PART_V1.svg", "./assets/elements_v2/icons/part_PART_V2.svg", "./assets/elements_v2/icons/part_PART_V3.svg", "./assets/elements_v2/icons/part_PART_W1.svg", "./assets/elements_v2/icons/part_PART_W2.svg", "./assets/elements_v2/icons/part_PART_W3.svg", "./assets/elements_v2/icons/skill_E1.svg", "./assets/elements_v2/icons/skill_E2.svg", "./assets/elements_v2/icons/skill_E3.svg", "./assets/elements_v2/icons/skill_F1.svg", "./assets/elements_v2/icons/skill_F2.svg", "./assets/elements_v2/icons/skill_F3.svg", "./assets/elements_v2/icons/skill_L1.svg", "./assets/elements_v2/icons/skill_L2.svg", "./assets/elements_v2/icons/skill_L3.svg", "./assets/elements_v2/icons/skill_V1.svg", "./assets/elements_v2/icons/skill_V2.svg", "./assets/elements_v2/icons/skill_V3.svg", "./assets/elements_v2/icons/skill_W1.svg", "./assets/elements_v2/icons/skill_W2.svg", "./assets/elements_v2/icons/skill_W3.svg"];
const imageCache = {};
const imagePromises = new WeakMap();
export function loadImage(src, defer = false) {
  const key = assetURL(src);
  if (imageCache[key]) return imageCache[key];
  const img = typeof Image === 'undefined' ? {} : new Image();
  img.assetSource = key;
  imageCache[key] = img;
  if (!defer && typeof Image !== 'undefined') img.src = key;
  return img;
}
export function readyImage(img) {
  if (img.complete && img.naturalWidth) return img.decode ? img.decode().then(() => img) : Promise.resolve(img);
  if (imagePromises.has(img)) return imagePromises.get(img);
  const promise = new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); img.removeEventListener('load', loaded); img.removeEventListener('error', failed); };
    const loaded = () => { cleanup(); (img.decode ? img.decode() : Promise.resolve()).then(() => resolve(img), reject); };
    const failed = () => { cleanup(); img.removeAttribute('src'); reject(new Error('그림을 불러오지 못했어요. 다시 출동해 주세요: ' + img.assetSource)); };
    const timer = setTimeout(failed, 20000);
    img.addEventListener('load', loaded, {once:true}); img.addEventListener('error', failed, {once:true});
    if (!img.getAttribute('src')) img.src = img.assetSource;
  });
  imagePromises.set(img, promise);
  promise.catch(() => imagePromises.delete(img));
  return promise;
}

export const SPRITES = Object.fromEntries(
  Object.entries(SPRITE_FILES).map(([k, v]) => [k, loadImage(v,true)])
);
export const UI_IMAGES = Object.fromEntries(
  Object.entries(UI_FILES).map(([k, v]) => [k, loadImage(v,true)])
);
// HEROES[id].frames[anim] = HTMLImageElement[]
export const HEROES = Object.fromEntries(
  Object.entries(HERO_FILES).map(([id, anims]) => [id, {
    ...HERO_INFO[id],
    frames: Object.fromEntries(Object.entries(anims).map(([a, list]) => [a, list.map(src=>loadImage(src,a!=='idle'))])),
  }])
);

// ---- 색조 틴트 (source-atop 합성) — 같은 원본 스프라이트를 콘텐츠별로 재채색 ----
export function loadHeroAssets(id) {
  return Promise.all(Object.values((HEROES[id] || HEROES.hoya).frames).flat().map(readyImage));
}
export async function loadBattleAssets(theme, hero, {ui2=false, pet=null, progress=()=>{}} = {}) {
  const images = [...new Set([
    ...[...COMMON_SPRITE_KEYS,...(CHAPTER_SPRITE_KEYS[theme] || [])].map(k => SPRITES[k]),
    ...Object.values((HEROES[hero] || HEROES.hoya).frames).flat(), ...Object.values(UI_IMAGES), ...Object.values(ELEMENT_WEAPONS),
    ...COMMON_ICON_FILES.map(src=>loadImage(src,true)),
    ...(ui2 ? ['btn_reroll','btn_check','fn_pause','hud_weapon_ranged'].map(n=>loadImage(`./assets/ui2/icons/${n}.webp`,true)) : []),
    ...ELEMENT_SKILL_NAMES.map(n => loadImage(`./assets/sprites/skills/${n}.webp`,true)),
    ...(ui2 ? UI2_SKILL_NAMES.map(n => loadImage(`./assets/ui2/skills/${n}.webp`,true)) : []),
    ...(pet ? [loadImage(`./assets/seoho_v1/pets/${pet}_idle.webp`,true)] : [])
  ])];
  let done=0,active=true; progress(0);
  try {
    await Promise.all(images.map(img => readyImage(img).then(() => {if(active)progress(Math.round(++done/images.length*100));})));
  } finally {active=false;}
}
const tintCache = {};
export function tintedSprite(img, colorRgba, key) {
  const cacheKey = key || (img.src + colorRgba);
  if (tintCache[cacheKey]) return tintCache[cacheKey];
  const w = img.naturalWidth || 16, h = img.naturalHeight || 16;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d");
  const draw = () => {
    cx.clearRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    cx.globalCompositeOperation = "source-atop";
    cx.fillStyle = colorRgba;
    cx.fillRect(0, 0, w, h);
    cx.globalCompositeOperation = "source-over";
  };
  // 2026-09-24 최적화: 캔버스를 그대로 그리면 매번 GPU로 다시 올린다 → 다 그린 뒤 ImageBitmap으로 바꿔 둔다(준비 전에는 캔버스로)
  const toBitmap = () => { if (typeof createImageBitmap === "function") createImageBitmap(c).then((bm) => { tintCache[cacheKey] = bm; }).catch(() => {}); };
  if (img.complete && img.naturalWidth) { draw(); toBitmap(); }
  else img.addEventListener("load", () => { c.width = img.naturalWidth; c.height = img.naturalHeight; draw(); toBitmap(); }, { once: true });
  tintCache[cacheKey] = c;
  return c;
}

// ---- 효과음: Web Audio API ----
// <audio> 엘리먼트를 복제해 재생하면 동시 타격이 많을 때 Chrome의 WebMediaPlayer 개수 한도
// ("too many WebMediaPlayers")에 걸려 소리가 끊긴다. 짧은 SFX는 AudioBuffer 한 번만 디코딩해두고
// 재생할 때마다 가벼운 BufferSource를 만드는 방식이 정석이라 그렇게 처리한다.
const MUTE_KEY = "lumen_muted";
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { /* 저장소 차단 환경: 기본값 사용 */ }

let audioCtx = null;
let masterGain = null;
const bufferCache = {};   // name -> AudioBuffer
const pendingLoads = {};  // name -> Promise
const lastPlayedAt = {};  // name -> timestamp (연타 스팸 방지)
const MIN_GAP_MS = 45;    // 같은 효과음 최소 간격
let activeVoices = 0;
const MAX_VOICES = 24;

function ensureCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function loadBuffer(name) {
  if (!SFX_FILES[name]) return Promise.resolve(null);   // Unknown optional sound must never fetch /undefined.
  if (bufferCache[name]) return Promise.resolve(bufferCache[name]);
  if (pendingLoads[name]) return pendingLoads[name];
  const ctx = ensureCtx();
  if (!ctx) return Promise.resolve(null);
  pendingLoads[name] = fetch(assetURL(SFX_FILES[name]))
    .then((r) => r.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => { bufferCache[name] = decoded; return decoded; })
    .catch(() => null);
  return pendingLoads[name];
}

// 첫 사용자 입력 시 오디오 컨텍스트를 깨우고 전체 프리로드(자동재생 정책 대응)
function primeAudio() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  for (const name in SFX_FILES) loadBuffer(name);
}
if (typeof window !== 'undefined') {
  window.addEventListener("pointerdown", primeAudio, { once: true });
  window.addEventListener("keydown", primeAudio, { once: true });
}

export function playSfx(name, volume = 0.6) {
  if (muted) return;
  const now = performance.now();
  if (lastPlayedAt[name] && now - lastPlayedAt[name] < MIN_GAP_MS) return;
  if (activeVoices >= MAX_VOICES) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const buf = bufferCache[name];
  if (!buf) { loadBuffer(name); return; } // 아직 디코딩 전이면 이번 재생은 건너뛴다
  lastPlayedAt[name] = now;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(masterGain);
    activeVoices++;
    src.onended = () => { activeVoices--; src.disconnect(); g.disconnect(); };
    src.start();
  } catch (e) { /* 재생 실패는 게임 진행에 영향 없음 */ }
}
// 보급 연출 효과음(2026-09-24 사용자 "뽑기가 너무 밋밋해"): 소리 파일 없이 짧게 합성한다. 음소거면 나지 않는다.
// supDrop 상자 쿵 · supShake 달그락 · supOpen 뚜껑 펑 · supReveal 결과(모든 결과 같음) · supLuck/supBig/supGrand 결과가 보인 뒤 축하(3·7개·등급 오름)
export function playSynth(kind) {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx || !masterGain) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.01;
  const tone = (f, t, d, { type = "triangle", vol = 0.18, to = null } = {}) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0 + t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + t + d);
    g.gain.setValueAtTime(0.0001, t0 + t); g.gain.exponentialRampToValueAtTime(vol, t0 + t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d);
    o.connect(g); g.connect(masterGain); o.start(t0 + t); o.stop(t0 + t + d + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };
  const noise = (t, d, vol, f0, f1) => {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * d)), ctx.sampleRate), a = buf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.frequency.setValueAtTime(f0, t0 + t); bp.frequency.exponentialRampToValueAtTime(f1, t0 + t + d);
    g.gain.setValueAtTime(vol, t0 + t); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d);
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t0 + t);
    src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
  };
  const arp = (notes, step, d, o) => notes.forEach((f, i) => tone(f, i * step, d, o));
  if (kind === "supDrop") { tone(200, 0, 0.2, { type: "sine", vol: 0.35, to: 55 }); noise(0, 0.09, 0.1, 400, 150); }
  else if (kind === "supShake") { tone(620, 0, 0.05, { vol: 0.09 }); tone(760, 0.17, 0.05, { vol: 0.09 }); }
  else if (kind === "supOpen") { noise(0, 0.3, 0.16, 700, 5200); tone(330, 0, 0.32, { type: "sine", vol: 0.16, to: 1050 }); }
  else if (kind === "supReveal") arp([784, 988, 1319], 0.07, 0.35, { vol: 0.13 });
  else if (kind === "supLuck") arp([659, 784, 988, 1319, 1568], 0.06, 0.4, { vol: 0.13 });
  else if (kind === "supBig") { arp([523, 659, 784, 1047], 0.08, 0.5, { vol: 0.15 }); [1047, 1319, 1568].forEach((f) => tone(f, 0.36, 0.8, { type: "sine", vol: 0.07 })); }
  else if (kind === "supGrand") {
    arp([523, 659, 784, 1047, 1319], 0.08, 0.55, { vol: 0.15 }); [523, 659, 784, 1047].forEach((f) => tone(f, 0.45, 1.3, { type: "sine", vol: 0.06 }));
    for (let i = 0; i < 9; i++) tone(1700 + Math.random() * 1700, 0.5 + i * 0.07, 0.22, { type: "sine", vol: 0.05 });
  }
}
export function isMuted() { return muted; }
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch (e) { /* 저장 실패는 무시 */ }
  if (masterGain) masterGain.gain.value = v ? 0 : 1;
  if (!v) primeAudio();
}
export function toggleMuted() { setMuted(!muted); return muted; }
