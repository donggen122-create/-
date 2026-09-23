# 에셋 출처 및 라이선스

이 문서는 `game/assets/`에 실제로 포함된 외부 에셋의 출처를 기록한다. 모든 파일은 아래 원본 페이지에서
**직접 다운로드해 프로젝트에 포함**했으며, 외부 URL을 코드에서 직접 참조하지 않는다.

## 그래픽 — Kenney "Tiny Dungeon"

- 제작자: Kenney (www.kenney.nl)
- 원본 페이지: https://kenney.nl/assets/tiny-dungeon
- 라이선스: CC0 1.0 (Creative Commons Zero — 저작권 없음, 상업적 사용/재배포/2차 수정 자유, 크레딧 의무 없음)
- 다운로드 파일: `kenney_tiny-dungeon.zip` (2022-07-05 릴리즈), `game/assets_src/tiny-dungeon/License.txt`에 원본 라이선스 텍스트 보관
- 수정 여부: 개별 16×16 타일을 그대로 사용(리사이즈 없음). 게임 내에서 **색조 틴트(canvas source-atop 합성)** 로 재채색해 사용한 곳이 있음(아래 매핑 표 "수정" 열 참조). 크롭·확대·이어붙임 등은 하지 않았다.

### 콘텐츠 ID ↔ 에셋 매핑

| 게임 요소 | 원본 타일 | 저장 파일명 | 수정 |
|---|---|---|---|
| 플레이어(파수꾼) | tile_0096 (파랑 갑옷 기사) | `sprites/player_knight.png` | 없음 |
| EN01 그림자 잔해 | tile_0121 (유령) | `sprites/enemy_wraith.png` | 런타임 보라색 틴트 |
| EN02 황혼 들개 | tile_0122 (거미) | `sprites/enemy_spider.png` | 런타임 강청색 틴트 (원작에 개 스프라이트가 없어 실루엣이 뚜렷한 거미로 대체 — 아래 "남은 대체/재해석" 참고) |
| EL01 거대 잔해(엘리트) | tile_0120 (박쥐형 마물) | `sprites/enemy_elite.png` | 런타임 적색 틴트 + 확대(1.6배) + 외곽 발광 |
| 봉화/장식 횃불 | tile_0029 (횃불) | `sprites/prop_torch.png` | 없음(코드로 깜빡임·발광 애니메이션 추가) |
| 배경 장식 바위 | tile_0024 (돌벽) | `sprites/prop_rock.png` | 없음 |
| 보물 상자(접근 시 골드 지급) | tile_0033 (상자) | `sprites/prop_chest.png` | 없음(개봉 후 어둡게 틴트) |
| 바닥 타일 | tile_0050 (흙바닥) | `sprites/floor_ground.png` | 없음(반복 타일링) |
| (미사용, 예비) | tile_0109 (임프) | `sprites/enemy_imp.png` | 향후 챕터 확장용으로 보관, 이번 적용에는 미사용 |

## 주인공 호야·민지 — 사용자 제공(Gemini 앱 생성)

- 원본: `이미지 에셋/주인공.png`, `주인공 전투.png`, `여주인공.png`, `여주인공 전투.png` (2048×2048, 마젠타/초록 단색 배경). 프로젝트 소유자가 Gemini 앱에서 생성해 제공한 이미지이며, 첫 참고 시트는 `game/assets_src/kids/sheet_original.webp`.
- 가공: `game/tools/cut_heroes.py`(Python 3.12 + Pillow/scipy)로 크로마키 → 격자선·잔상 제거 → 프레임별 투명 PNG(높이 128px, 발바닥 정렬) → `game/assets/sprites/heroes/*.png` 27장.
- 프레임 구성: 서 있기 1 · 걷기 3 · 달리기 3 · 점프(호야 2, 민지 1) · 공격 3 · 피격 1 · 쓰러짐 1. 호야 피격은 원본 칸이 글자·잔상과 겹쳐 깨져 있어 서 있기 프레임을 재사용(피격 섬광으로 표현). 민지 점프 최고점은 반투명 격자가 다리 뒤에 겹쳐 분리 불가라 뛰어오르는 프레임만 사용.
- 라이선스: 사용자 소유 생성물. 외부 재배포 시 Gemini 이용약관 확인 필요.
- 기존 기사(`player_knight.png`, Kenney Tiny Dungeon)는 더 이상 플레이어에 쓰지 않으며 파일만 보관.

## 시작 화면 그림 — 사용자 제공(Gemini 앱 생성)

- 원본(`이미지 에셋/`): `시작화면 세로.png`(1536×2752), `이미지 가로.jpg`(1024×572), `주인공 배경.jpg`(호야 응원 포즈, 마젠타 배경), `여주인공 세로.jpg`(민지, 초록 배경), `마스코트.jpg`(무궁화·'서호' 글자 배지 엠블럼, 2차), `등불.jpg`(새싹 지구 마스코트, 2차). 우클릭 저장분은 1024px 미리보기 화질.
- 가공: 배경은 JPEG로 축소(`game/assets/ui/title_portrait.jpg` 1024×1835, `title_landscape.jpg`). 단색 배경 그림은 `game/tools/cut_title_art.py`로 투명 PNG(`title_hoya/minji/emblem/mascot.png`).
- 라이선스: 사용자 소유 생성물.

## 환경 테마 1 「쓰레기 마을」 그림 — 사용자 제공(Gemini 앱 생성, 2026-09-22)

- 원본(`이미지 에셋/`, 우클릭 저장 JPG 1024px): `테마 1단계 흙.jpg`(운동장 흙 바닥), `바닥 타일.jpg`(골목 시멘트 바닥), `쓰레기산.jpg`(쓰레기 깔린 땅), `테마 1단계 소품.jpg`(분리수거함·넘어진 쓰레기통·봉투 더미·타이어·벤치·쓰레기 무더기, 마젠타 배경), `테마 1단계 적.jpg`(과자봉지 유령·꽁초 벌레·페트병 병정·비닐봉지 유령·음식물 쓰레기 덩어리·파리), `테마 1단계 보스.jpg`(쓰레기 산 대왕 평소/화난 모습), `아이템. 공용.jpg`(새싹·큰 새싹·재활용 봉투·하트·지구 에너지 구슬·별가루).
- 가공: `game/tools/cut_theme1.py` → `game/assets/sprites/t1/`. 소품·적·보스·아이템은 마젠타 크로마키 후 상자별로 잘라 투명 PNG(적 160px·보스 300px·소품 120~200px·아이템 64px). 바닥 3장은 Gemini 별 표식을 덮고 반 칸 밀어 섞는 방식으로 이어 붙게 만든 뒤 448px로 축소. 적 시트의 영어 이름표는 잘라 냈다.
- 게임 내 사용: 바닥은 `chapter.floor`로 단계별 교체(1-1·1-3 흙, 1-2·1-4 시멘트, 1-5 쓰레기), 분리수거함 = 정화 장치(봉화 자리), 재활용 봉투 = 보물 상자 자리, 새싹 = 경험치 보석 자리. 적·보스는 `src/themes.js`의 T1_* 정의(색조 없이 원본색, 부드럽게 축소).
- 라이선스: 사용자 소유 생성물. 외부 재배포 시 Gemini 이용약관 확인 필요.

## 1장 이펙트 그림 — Codex(OpenAI) 생성 (2026-09-22)

- Codex(ChatGPT 코딩 에이전트)가 OpenAI image_gen으로 새로 생성해 `game/assets/sprites/vfx/`에 추가: `purify-v1.png`(정화 터짐), `smog-v1.png`(악취 구름), `splash-v1.png`(물 튐). 원본 1280×1280 투명 PNG → 이 프로젝트에서는 512×512로 축소해 보관(게임은 256px 캐시로 그림). 원본 1280px과 생성 프롬프트는 `docs/codex/2026-09-22_그림_생성_기록.md`와 `/share/seoho-effects-update-2026-09-22.zip`.
- 사용: `src/theme-effects.js`(정화·물방울·악취·회복·소환·등장·폭주 효과, 보스 6종 예고). 라이선스: 사용자 소유 생성물(OpenAI 이용약관 확인).

## 원소 스킬·지원품 그림 — 사용자 Gemini 생성 (2026-09-22 밤)
- 원본: `이미지 에셋/스킬 불.jpg`, `스킬 물.jpg`, `스킬 바람.jpg`, `스킬 흙.jpg`, `스킬 번개.jpg`(1024×1024, 4×4), `지원품 아이콘.jpg`(3×3). 프롬프트: `이미지 에셋/원소_스킬_프롬프트.md`.
- 가공: `game/tools/cut_skills.py` → `game/assets/sprites/skills/*.png` 88장(투사체·폭발·장판·진화·지원품 아이콘). 라이선스: 사용자 소유 생성물(Google Gemini 이용약관 확인).

## 주인공 원거리 공격 그림 — 사용자 Gemini 생성 (2026-09-22 밤)
- 원본: `이미지 에셋/주인공 방망이 이동.jpg`, `주인공 방망이 전투.jpg`, `여주인공 피구공 전투.jpg`(사용자가 Gemini 앱에서 생성, 1024×1024, 3×3). 프롬프트: `이미지 에셋/주인공_야구방망이_프롬프트.md`.
- 가공: `game/tools/cut_heroes_bat.py` → `game/assets/sprites/heroes/hoya_ranged_*.png`(17장), `minji_ranged_*.png`(9장). 라이선스: 사용자 소유 생성물(Google Gemini 이용약관 확인).

## Guardian v1 개편 그림 — Codex(OpenAI) 생성·제작 (2026-09-22)
- `game/assets/seoho_v1/pets/*_idle.png` 6장(고양이·사슴·수달·물범·참새·거북, 투명 PNG, Codex가 OpenAI image_gen으로 생성) — 동물 친구.
- `game/assets/seoho_v1/icons/*.svg` 20개(화살표·책·신발·빗자루·코인·선물·집게·손잡이·하트·지도·이용권·바람개비·씨앗·방패·옷·반짝·해·물·물총·바람, Codex가 직접 그린 SVG, `tools/create-icons.mjs`) — 로비·전투 UI 아이콘.
- 사용: `src/rework-ui.js`, `src/main.js`. 설명서: `docs/GUARDIAN_V1_RESOURCES.md`, `resource-manifest.json`. 라이선스: 사용자 소유 생성물(OpenAI 이용약관 확인).

## 제목 글꼴 — Jua (Google Fonts, SIL Open Font License 1.1)

- 원본: https://github.com/google/fonts/tree/main/ofl/jua (`game/assets_src/fonts/Jua-Regular.ttf`, 라이선스 `Jua-OFL.txt`).
- 가공: 시작 화면·로비 제목에 쓰는 글자만 추린 부분 글꼴 `game/assets/ui/jua-title.woff2`(13KB). 다른 글자는 시스템 글꼴로 대체되므로 제목 문구를 바꾸면 `fontTools.subset --text=`로 다시 추려야 한다(STATUS.md 참조).

## UI 프레임 — Kenney "Fantasy UI Borders"

- 원본 페이지: https://kenney.nl/assets/fantasy-ui-borders
- 라이선스: CC0 1.0
- 사용 파일: `panel-border-006.png`→`ui/panel-border.png`(메인 패널), `panel-border-004.png`→`ui/panel-border-thin.png`(레벨업 카드)
- 수정 여부: 없음(원본은 흰색 선화이며, CSS `filter`로 톤만 조절해 사용. 파일 자체는 무수정)

## 효과음 — Kenney "RPG Audio" / "UI Audio" / "Impact Sounds"

- 원본 페이지: https://kenney.nl/assets/rpg-audio , https://kenney.nl/assets/ui-audio , https://kenney.nl/assets/impact-sounds
- 라이선스: 모두 CC0 1.0
- 수정 여부: 없음(원본 OGG 그대로, 파일명만 용도에 맞게 변경)

| 게임 상황 | 원본 파일 | 저장 파일명 |
|---|---|---|
| 공격 발사 | RPG Audio `cloth1.ogg` | `audio/attack_whoosh.ogg` |
| (예비) 근접 공격 | RPG Audio `knifeSlice.ogg` | `audio/attack_slice.ogg` |
| 적 피격 | Impact Sounds `impactGeneric_light_000/002.ogg` | `audio/hit_light.ogg`, `hit_light2.ogg` |
| 엘리트/보스 피격 | Impact Sounds `impactBell_heavy_001.ogg` | `audio/hit_boss.ogg` |
| 경험치 보석 획득 | RPG Audio `metalClick.ogg` | `audio/gem_pickup.ogg` |
| 골드/보상 지급(결과 화면) | RPG Audio `handleCoins.ogg` | `audio/gold_reward.ogg` |
| 보스 패턴 예고 | RPG Audio `creak2.ogg` | `audio/boss_telegraph.ogg` |
| 레벨업 카드 등장 | UI Audio `switch7.ogg` | `audio/levelup_open.ogg` |
| 카드/버튼 선택 | UI Audio `switch14.ogg` | `audio/card_select.ogg` |
| 일반 버튼 클릭 | UI Audio `click2.ogg` | `audio/ui_click.ogg` |

## 자체(코드) 제작 — 이미지 생성 도구 미사용

이 세션에는 이미지 생성 도구가 연결되어 있지 않아, 이미지 생성 도구를 사용했다고 표기하지 않는다.
아래는 전부 Canvas 2D 코드로 절차적으로 그린 것이다(래스터 이미지 파일 없음):

- **보스 BS01 황혼의 거목**: 어울리는 "황혼의 고목 몬스터" 공개 스프라이트를 찾지 못해 트렁크+가지+캐노피+발광하는 눈을 코드로 직접 그림(가지 흔들림·2페이즈 색 변화 애니메이션 포함).
- 경험치 보석(빛나는 결정), 투사체 및 궤적(발광 오브+trail), 피격 섬광, 사망 파티클, 레벨업 카드 등장 이펙트, 보스 패턴 예고(원형 균열/부채꼴 경고/방사형 경고선), 봉화 불빛 확산(radial gradient), 바닥 비네트.

## 남은 대체/재해석 (정직한 고지)

- EN02(황혼 들개)는 원작 기획의 "개" 실루엣 에셋을 공개 팩에서 찾지 못해 거미(tile_0122)로 대체했다. 추후 반려동물/몬스터 팩을 추가로 조사해 교체할 수 있다.
- 캐릭터 12종 중 1종(파수꾼 기사)만 그래픽이 있다. 나머지 11종은 아직 미구현(로직 자체가 없음, STATUS.md 참조).
- 배경은 반복 타일 1종 + 장식 소품(바위·횃불, 순수 연출)과 상호작용 가능한 보물 상자(접근 시 골드 1회 지급)이며, CH01 데이터의 "어둠 지대 없음"에 맞춰 어둠 연출은 넣지 않았다. 봉화 조명(광원 확산)만 장식으로 배치했다.
- 진화/융합 카드, 상태 이상 아이콘 등은 로직 자체가 아직 없어 그래픽도 없다.
