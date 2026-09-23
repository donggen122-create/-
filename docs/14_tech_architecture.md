# 14. 기술 구조·데이터 명세·제작 도구

---

## 1. 기술 선택 (브라우저)

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript (strict) | 데이터 스키마 타입 공유, AI 코딩 도구 친화 |
| 번들 | Vite + PWA 플러그인 | 빠른 개발, 오프라인 캐시(모바일 브라우저 홈화면) |
| 전투 렌더 | PixiJS v8 (WebGL2, WebGPU 선택) | 스프라이트 배칭으로 1,000+ 개체, ParticleContainer, 텍스처 아틀라스 |
| UI | DOM(HTML/CSS) 오버레이 + 경량 상태 스토어 | 한국어 텍스트 렌더링·접근성·터치 영역 처리가 캔버스보다 안정적. 전투 HUD만 Pixi |
| 시뮬레이션 | 자체 고정 틱 60Hz, 렌더 분리 | 결정적 재현(시드), 저사양에서 렌더만 낮춤 |
| 데이터 | CSV/JSON → 빌드 시 `content.bundle.json`(검증 후) | 콘텐츠 제작자는 CSV 편집, 런타임은 검증된 JSON만 |
| 저장 | IndexedDB(주) + localStorage(메타·폴백) + 파일 내보내기 | 용량·비동기·백업 |
| 오디오 | Web Audio API, 채널 풀 16 | 동시 재생 제한·우선순위 |
| 테스트 | Vitest(시뮬 단위·재현), Playwright(UI 흐름) | 시드 기반 골든 테스트 |
| 서버(확장) | 별도 저장소. REST + 결정적 리플레이 검증 | 로컬판과 경계 명확(§9) |

폴더 구조:
```
/src
  /engine      틱 루프, RNG, 공간 해시, 풀, 이벤트 버스
  /sim         전투 상태·엔티티·효과 노드·상태 이상·적 AI·보스 패턴·웨이브
  /content     content.bundle.json 로더, 타입, 검증기
  /meta        계정·인벤토리·성장·보상·미션·업적·이벤트 (전투 외 로직)
  /save        스키마 버전, 마이그레이션, 백업, 내보내기
  /render      Pixi 씬, 스프라이트 풀, 파티클, 카메라, 피해 숫자
  /ui          DOM 화면 22 + 컴포넌트
  /tools       개발 도구(§8, 별도 진입점)
/data          CSV/JSON 원본 (이 기획서의 data/)
/assets        아틀라스·오디오·폰트
```

---

## 2. 전투 상태와 화면 전환

```
AppState: Boot → Lobby → (ModeSelect|ChapterSelect) → RunSetup → Run → Result → Lobby
Run 내부 FSM: Intro → Playing ⇄ Paused ⇄ CardSelect ⇄ ChestSelect → BossPhase → (Victory|Defeat) → Result
```
- `RunConfig` = {mode_id, chapter_id|challenge_id|mode_params, time_mode, character_id, preset(equipment, parts, pets, blueprint), seed, rules[]}.
- `RunState`(시뮬 전용, 렌더 무관): tick, rng streams, player, entities(SoA), skills[], passives[], statuses, spawner, boss, beacon, stats(분석용 누적).
- 렌더는 `RunState`를 읽기만 하고 보간 표시. UI 이벤트는 커맨드 큐로 시뮬에 전달(선택·일시정지).
- `Result` 생성 시 `run_id`(uuid) 포함, 보상 계산은 `meta/rewards.ts`가 `RunSummary`만으로 수행(시뮬 객체 직접 접근 금지).

---

## 3. 스킬·효과·상태 이상 처리 구조

### 3.1 효과 그래프
스킬 = `trigger` + `emitters[]` + `on_hit[]` + `modifiers`.
```json
{
  "id": "S09",
  "trigger": {"type": "interval", "interval_s": 2.0, "aim": "NEAREST", "range_u": 6},
  "emitters": [{"type": "projectile", "count": 1, "speed_u": 8, "arc": true, "pierce": 0, "on_expire": "explode"}],
  "on_hit": [{"type": "damage", "coef": 1.4}],
  "on_explode": [{"type": "area_damage", "radius_u": 1.6, "coef": 1.4}, {"type": "apply_status", "status": "burn", "stacks": 1}],
  "levels": {"2": {"radius_mul": 1.25}, "3": {"count_add": 1}, "4": {"coef_mul": 1.3}, "5": {"on_explode_add": [{"type": "spawn_field", "field": "burn_patch", "duration_s": 2}]}}
}
```
**효과 노드 타입(출시판 22)**: `damage, area_damage, apply_status, knockback, pull, chain, bounce, split, mark, heal, shield, spawn_projectile, spawn_field, spawn_summon, spawn_turret, spawn_strike(지연 낙하), beam, orbit, wall(잔류 벽), clone, gamble(주사위), light(광휘 변화)`.
진화·융합은 `replace_skill` 데이터: 새 스킬 정의 + `inherit_level_bonus`.

### 3.2 스탯 파이프라인
`StatSheet`는 `합연산 버킷(Map<statKey, number>)`과 `곱연산 버킷`으로 분리. 모든 출처(패시브·장비·특성·세트·수집품·부품·펫 지원·캐릭터·규칙)가 같은 API `addStat(source, key, value, mode)`를 호출. 상한은 `balance.json.caps`에서 키별 정의, 초과분은 `StatSheet.wasted`에 기록(UI 회색 표시·분석용).

### 3.3 상태 이상
`StatusInstance {type, stacks[], snapshotATK, source}`; 틱마다 타이머 감소. 보스 저항은 `enemy.resist[type]`. 새 상태 이상 = `statuses.json`에 정의(틱 간격·계수·중첩·보스 규칙)만 추가.

### 3.4 확장 지점 (코드 변경 필요)
- 새 효과 노드 타입(예: "반사 벽"): `sim/effects/nodes/*.ts`에 노드 1개 + 검증 스키마 + 렌더 표현.
- 새 조준 방식: `sim/aim.ts` enum 추가.
- 새 상태 이상 '행동 변화'(예: 조작 반전): `sim/player.ts` 훅.
- 새 지형 기믹 키(`wave_params`): `sim/gimmicks/*.ts` 1개.

---

## 4. 적 행동과 보스 패턴
- 일반 적: `behavior` enum(13) + `ability` 파라미터 → `sim/ai/behaviors/*.ts`. 데이터만으로 조합.
- 보스: `patterns[]`(예고 형태 `telegraph_shape: circle|line|cone|ring|full`, 지속, 판정 콜백 노드) + `phases[]` + `scheduler`(휴식, 연속 금지, `no_overlap_rule`을 `forbid_during[]` 배열로 구조화). `boss_overrides`(변형)는 패턴 필드 패치(JSON merge patch).
- 소환은 효과 노드 `spawn_enemy`로 통일.

## 5. 웨이브 생성과 난이도 제어
- `WaveDirector`: 템플릿 세그먼트를 판 길이 비율로 해석, `density`·`enemy_mult`·모드 규칙 적용. 폭발 웨이브는 스폰 큐에 일괄 삽입.
- 개체 상한·대기열·화면 밖 재배치(06장 §8).
- 동적 보정: 5s마다 플레이어 생존 지표(체력 비율·최근 피격) 계산 → **보상·XP에 영향 없는** 스폰 방향 가중치만 조정(어려움을 낮추지 않고 공정하게 배치). 난이도 자체는 데이터 고정.

## 6. 보상 지급과 중복 방지
```
RunSummary → RewardCalculator(pure) → PendingReward{run_id, items[]}
→ SaveTransaction: if run_id ∈ save.claimed_runs → skip; else apply + append run_id (최근 500개 유지)
```
- 상자 개봉·상점 구매·이벤트 환전도 `op_id` 멱등.
- 천장 카운터는 상자 테이블별 `pity[table_id]`.

## 7. 난수와 재현
- xoshiro128** 시드 스트림 분리: `spawn, cards, loot, boss, gimmick, misc`. 입력(이동 벡터·선택)은 틱 인덱스와 함께 `InputLog`에 기록.
- 재현 = 같은 `RunConfig.seed` + `InputLog` → 동일 결과(부동소수 결정성 위해 시뮬은 정수/고정소수 또는 동일 연산 순서 보장, `Math.*` 대신 자체 근사 함수 사용).
- 골든 테스트: 시드 12개 × 챕터 5개 결과 해시 고정.

## 8. 저장 형식·마이그레이션·백업

```json
{
  "schema_version": 3,
  "created_at": "...", "updated_at": "...", "device_id": "...",
  "account": {"level": 12, "xp": 5400, "titles": [], "settings": {...}},
  "currencies": {"GOLD": 12000, "DUST": 300, "ENERGY": {"value": 80, "last_tick": "..."}, "SEAL": {"C01": 10}, "EVENT": {"EV_T1#2026S1": 12}},
  "characters": {"C01": {"level": 10, "promo": 1, "awaken": 0}},
  "inventory": {"equipment": [{"uid": "e1", "id": "EQ01", "grade": 2, "level": 5, "locked": false}], "parts": [...], "pets": [...], "collectibles": {"CO001": {"level": 2, "dupes": 0}}},
  "loadout": {"character": "C01", "equipment": {"WPN": "e1"}, "parts": {...}, "pets": {...}, "blueprint": {...}},
  "presets": [...],
  "talents": {"TA01": 3},
  "progress": {"chapters": {"CH01": {"cleared": true, "stars": 3, "best_mode": 15}}, "challenges": {}, "tower_floor": 12, "modes": {...}},
  "missions": {"daily": {"date": "...", "list": [...]}, "weekly": {...}},
  "achievements": {"AC001": {"progress": 1, "claimed": true}},
  "events": {"EV_T1#2026S1": {...}},
  "pity": {"RW_EQ_CHEST_R": 12},
  "claimed_runs": ["..."], "claimed_ops": ["..."],
  "records": {"boss_score": {"week": "...", "best": 12345}, "infinite_best_s": 900},
  "offline": {"last_claim": "..."},
  "codex": {"enemies": [...], "bosses": [...]}
}
```
- `migrations[]`: `v1→v2` 함수 배열, 순차 적용, 적용 전 자동 백업.
- 백업 슬롯 3(자동: 매일 첫 접속·마이그레이션 전·수동). 내보내기 = JSON + SHA-256 체크섬 + 버전. 가져오기 = 검증(스키마·ID 참조·체크섬) → 미리보기 → 적용.
- 저장 시점: 결과 화면, 로비 조작 후 1s 디바운스, 앱 숨김(visibilitychange). 전투 중 저장 없음.

## 9. 로컬/서버 경계
`interface Backend { loadSave(); saveSave(); submitRecord(); getShopState(); claimEvent(); }` — 로컬 구현이 기본. 서버 구현 시 검증 항목: 기록 제출은 `RunConfig + InputLog` 제출 후 서버 리플레이(동일 시뮬 코드, Node 실행)로 점수 재계산. 상점·이벤트 환전은 서버 멱등. 로컬판은 시계 조작에 취약(오프라인 보상 상한 8h로 완화)하며 이는 로컬판 한계로 문서화(16장).

---

## 10. 콘텐츠 테이블 명세

공통 규칙: ID는 `^[A-Z]{2,4}\d{2,3}$`(예 `S01`, `CH01`, `CL001`). 모든 외래 ID는 빌드 시 검사(존재·타입·순환). 숫자 필드는 `min/max` 범위. 문자열 열의 `;`는 리스트 구분자. 대표 레코드는 data/ 파일의 첫 행.

| 테이블 | 파일 | 필수 필드(타입) | 외래 ID | 검증 규칙 |
|---|---|---|---|---|
| characters | characters.json | id, name, role, base_weapon(S##), base_stats{atk,hp,spd,def:number}, passive, unique_ability{name,effect}, affinity_tags[], locked_skills[], promo_bonus{3,5}, awaken_bonus{2,3}, signature_build(B##) | skills, builds | base_weapon ∉ locked_skills; atk+hp/10 ∈ [185,255]; affinity_tags ⊂ skills.tags |
| skills | skills.csv | id, name, role, tags[], aim(enum 9), dmg_coef(0.1~5), interval_s(0~10), projectiles(0~12), pierce(0~999), range_u(0~12), duration_s, lv2~lv5(text), evo_passive(P##), evo_passive_lv(1~3), evo_id(E##), part_id(T##), perf_cost(1~5) | passives, evolutions, parts | evo_id.source_a == id; part_id.skill_id == id; 24행 |
| passives | passives.csv | id, name, stat(key), per_level, lv1~lv5, cap, applies_to, stack_type(합연산\|곱연산), evo_partner_skills[] | skills | stat ∈ balance.caps 키; 각 패시브 ≥1 스킬 짝 |
| evolutions | evolutions.csv | id, name, type(evolution\|fusion), source_a(S##), source_b(P##\|S##), behavior_change, dmg_coef, interval_s, upgrades, visual | skills, passives | evolution: source_b∈passives; fusion: source_b∈skills ≠ source_a; behavior_change 길이 ≥ 20 |
| enemies | enemies.csv | id, name, type(normal\|elite), behavior(enum 13), hp_mult, atk_mult, spd_u, radius_u, mass(1~999), xp, env_home(ENV##), first_chapter(CH##), ability, counter_tip | chapters | first_chapter의 enemy_mix에 포함; normal 40, elite 12 |
| bosses | bosses.json | id, name, env, hp_mult, atk_mult, radius_u, spd_u, patterns[≥3]{name,telegraph,telegraph_s,dodge,dmg,cooldown_s}, phases[≥1], rest_s(≥1.0), safe_zone, melee_note, summons, no_overlap_rule, resist{}, final_of[], mid_of[] | chapters, enemies(summons 텍스트 내 ID) | final_of ↔ chapters.final_boss 일치; telegraph_s ≥ 0.5 (0 허용은 dmg 0만) |
| chapters | chapters.csv | id, name, env, map_structure(open\|corridor\|arena\|path), time_limit, enemy_mult, enemy_mix[≥2], gimmick, mid_bosses[3](형식 `ID(m:ss)`), final_boss(BS##[vN]), first_clear_reward, repeat_reward, unlocks, wave_template(WT##), wave_params(k=v;…) | enemies, bosses, wave_templates | enemy_mult 단조 증가; mix의 first_chapter ≤ id; wave_params 키 ∈ 허용 목록 |
| waves | waves.csv | chapter_id, t_start_s, t_end_s(≥start), event(enum 10), enemy_id(EN/EL/BS/ALL/-), amount, formation, note | chapters, enemies, bosses | boss_final 정확히 1행/챕터; 시간 ≤ time_limit |
| wave_templates | wave_templates.csv | id, name, structure_fit, segments(DSL), burst_events(DSL), notes | — | 세그먼트 구간 [0,1] 연속·중복 없음; M# ≤ 6 |
| challenges | challenges.csv | id, chapter_id, tier(1~3), name, rules[R##;…], params, reward, unlock | chapters, challenge_rules | 챕터당 3행 tier 1·2·3; R21 시 params.char ∈ characters; R22 시 ban ⊂ skills |
| challenge_rules | challenge_rules.csv | id, name, category, effect, param_default, counter_axis | — | 26행 |
| equipment | equipment.csv | id, slot(6 enum), name, set_id(ESET0#), main_stat(atk\|hp), base_value, opt1_rare, opt2_epic, legend_effect, source_hint | — | 슬롯당 8; set_id별 6(슬롯 각 1) |
| parts | parts.csv | id, name, skill_id(S##), stat_type(atk\|hp), stat_common~stat_myth(단조 증가), behavior_epic, behavior_legend, behavior_myth, resonance_lv30 | skills | skill_id 유일 |
| pets | pets.csv | id, name, ai_type(enum), role, deploy_skill, deploy_interval_s, deploy_coef, assist_skill, hp_pct_of_player(10~100), speed_u, evolve_change, awaken_skill, unlock, notes | — | assist_skill 유일(중복 금지 규칙 위해) |
| collectibles | collectibles.csv | id, set_id(SET##), name, rarity(rare\|epic\|legend), effect_type(stat\|util\|rule\|econ), effect, lv5_effect, cap, source | sets | 세트당 5, 전설 1·영웅 2·희귀 2 |
| sets | sets.csv | id, name, theme, bonus_3, bonus_5, build_axis, source | — | 20행 |
| talents | talents.csv | id, branch, tier(1~7), name, type(stat\|util\|rule), effect_per_rank, max_rank, cost_tp, cost_gold, prereq(ID\|ID or -), unlock_cond | talents | prereq 티어 < 자기 티어; 순환 없음; 분기 28 |
| missions | missions.csv | id, type(daily\|weekly), name, condition, target, reward, weight, unlock, leads_to_mode(M##\|-) | modes | daily ≥ 24, weekly ≥ 20 |
| achievements | achievements.csv | id, category, name, condition, target, reward, hidden(bool) | collectibles(reward 내 CO) | 100행; hidden ≤ 5 |
| rewards | rewards.csv | table_id, kind(drop\|shop), entry, item_ref, weight_or_price, qty, pity_or_limit, notes | 모든 아이템 테이블 | drop 테이블 weight 합 = 100; item_ref 파싱 가능 |
| events | events.json | templates[6]{id, name, duration_days, token{}, participation, progress, shop(RW_EV_*), leftover_policy, reusable_data{}, unlock} | rewards | shop 테이블 존재 |
| modes | modes.csv | id, name, unlock, entry_cost, duration, win_condition, lose_condition, reset_scope, enemy_boss_setup, unique_rules, rewards, repeat_limit, linked_systems | — | 8행 |
| builds | builds.json | id, name, character, equipment[6], attack[6], passive[6], essential[], alternatives{}, early_priority[], evo_order[], pets{deploy,assist[2]}, parts[3], support_parts[2], sets[], modes[], counters[] | 전부 | attack[0] == character.base_weapon; 장비 슬롯 6종 각 1; pets.assist_skill 중복 없음 |
| balance | balance.json(신규) | caps{}, curves{}, costs{}, drop{}, timings{} | — | 12장 상수 전부 여기서만 정의 |

**빌드 시 검증기(`tools/validate.ts`)**는 위 규칙 전부를 실행하고, 실패 시 번들 생성을 중단한다. CSV 인용·구분자 오류는 행 번호와 함께 보고.

---

## 11. 콘텐츠 추가 시 코드 수정 불필요 범위
- 새 챕터·도전·미션·업적·수집품·장비·펫(기존 AI 유형)·부품(기존 노드)·적(기존 behavior)·보스(기존 예고 형태·노드)·이벤트 인스턴스·상점 → **데이터만**.
- 새 효과 노드·조준·행동·기믹·AI 유형·이벤트 템플릿 → §3.4 확장 지점.

---

## 12. 개발용 도구 (`/tools`, 별도 진입점, 프로덕션 번들 제외)

| 도구 | 기능 | 입력 | 출력·통과 기준 |
|---|---|---|---|
| 웨이브 미리보기 | 챕터·모드·시간 모드 선택 → 시간축 그래프(생성률·개체 수·엘리트·보스·기믹), 헤드리스 시뮬로 예상 개체 수 | chapters, waves, templates | 개체 상한 초과 구간 표시 |
| 보스 패턴 테스트 | 보스·변형 선택, 단계 강제, 패턴 강제 실행, 예고 시각화, 겹침 규칙 위반 로그 | bosses.json | no_overlap 위반 0 |
| 빌드 생성기 | 캐릭터·장비·부품·펫·수집품·특성 조합 → StatSheet 표(합/곱, 상한 낭비) | 전 데이터 | — |
| DPS 측정 | 스킬/진화/레벨 × 시나리오(단일 더미·밀집 10·보스 더미) 60s 헤드리스 → 계수/초·명중률·성능 비용 | skills, evolutions, parts | 12장 §9.2 표 자동 생성, 세 축 최고 집중 경고 |
| 드롭 시뮬레이터 | 상자 N회 몬테카를로 → 등급 분포·천장 발동·목표 기대 횟수 | rewards.csv | 확률 합 100 검증 |
| 경제 시뮬레이터 | 플레이 프로필(30/60/120분) × 30일 → 재화 수지·도달 챕터 | 전 데이터 + balance | 11장 표 ±15% |
| 성능 스트레스 | 적 1,000 + 투사체 600 씬, 프레임타임 히스토그램, GC 카운트 | — | 15장 기준(p95) |
| 저장 데이터 검사 | 저장 JSON 검증·마이그레이션 드라이런·참조 무결성·체크섬 | save.json | 오류 0 |
| 자동 플레이 봇 | 12 빌드 × 60 챕터 헤드리스(보석 방향 이동 + 청사진 선택) | 전 데이터 | 클리어율·시간 표 |
| 시드 리플레이 | RunConfig + InputLog → 결과 해시 비교 | — | 골든 해시 일치 |
