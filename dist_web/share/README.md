# LUMEN (황혼의 파수꾼) — 개발용 기획서 및 콘텐츠 데이터

탑다운 서바이벌 액션 RPG(브라우저, PC/모바일) 출시판 설계도. 원작(탕탕특공대/Survivor.io) 조사를 바탕으로 장르 핵심 재미와 시스템 연결을 참고했으며, 세계관·이름·콘텐츠는 모두 신규 창작이다.

작성일 2026-09-17 · 문서 버전 0.1 · 모든 수치는 설계 추정치(구현 후 `balance.json`에서 조정)

---

## 1. 요구 산출물 순서 ↔ 파일 매핑

| # | 요구 항목 | 파일 |
|---|---|---|
| 1 | 핵심 방향과 독창적 게임 콘셉트 | docs/01_concept.md |
| 2 | 원작 조사 결과·출처·미확인 사항 | docs/02_research.md |
| 3 | 원작 시스템 → 설계 대응표 | docs/03_mapping.md |
| 4 | 전체 플레이 루프와 시스템 의존 관계 | docs/04_loops.md |
| 5 | 출시판·장기 확장판 콘텐츠 수량표 | docs/05_content_scope.md |
| 6 | 전투 및 성장 시스템 상세 명세 | docs/06_combat_spec.md, 07_skills_evolutions_builds.md, 08_chapters_enemies_bosses.md, 09_progression_systems.md, 10_modes_events.md |
| 7 | 모든 출시 콘텐츠 목록과 핵심 수치 | data/ 전체(§2) |
| 8 | 경제·진행 속도·빌드 검증 | docs/11_economy.md, 12_formulas_balance.md |
| 9 | 화면 명세와 첫 사용자 경험 | docs/13_ui_ux.md |
| 10 | 기술 구조·데이터 명세·제작 도구 | docs/14_tech_architecture.md, 15_performance_art.md |
| 11 | 단계별 구현 백로그와 완료 기준 | docs/16_dev_phases.md |
| 12 | 리스크와 미확정 가정 | docs/17_risks.md |
| 13 | 다음 코딩 작업 구현 지시 프롬프트 | docs/18_implementation_prompt.md |
| — | 요구사항 자체 점검 | docs/19_requirements_checklist.md |
| — | 환경 테마 30단계 재편(서호팡팡수호대, 콘텐츠 방향 우선) | docs/20_환경_스테이지.md |
| — | 제미나이 생성용 에셋 제작 목록·규칙·프롬프트 | docs/21_에셋_제작_목록.md |

---

## 2. 데이터 파일 (data/)

| 파일 | 행 수 | 내용 | 참조 문서 |
|---|---|---|---|
| characters.json | 12 | 캐릭터 역할·기본 무기·고유 능력·해금·승급·각성 | 09 §1 |
| skills.csv | 24 | 공격 스킬(17필드: 조준·계수·간격·투사체·관통·범위·지속·Lv2~5·진화·강약·부품·성능) | 07 §1 |
| passives.csv | 18 | 패시브 단계·상한·대상·합/곱 | 07 §2 |
| evolutions.csv | 28 | 진화 24 + 융합 4(행동 변화) | 07 §3 |
| parts.csv | 24 | 부품 등급별 능력치·동작 변경·공명 | 09 §3 |
| builds.json | 12 | 실전 빌드(슬롯 전체·대체·우선·진화 순서·펫·부품·세트·모드·대응) | 07 §4 |
| enemies.csv | 52 | 일반 40 + 엘리트 12(행동 13종) | 08 §3 |
| bosses.json | 20 | 패턴 3~5·단계·휴식·안전지대·소환·겹침 방지·등장 챕터 | 08 §4 |
| chapters.csv | 60 | 환경·구조·시간·배수·적 조합·기믹·중간/최종 보스·보상·해금·웨이브 템플릿·파라미터 | 08 §2 |
| waves.csv | 224 | 챕터 1~10 초 단위 웨이브 시간표 | 08 §2.1 |
| wave_templates.csv | 12 | 챕터 11~60 생성 템플릿(세그먼트 DSL) | 08 §2.2 |
| challenge_rules.csv | 26 | 도전 규칙 | 08 §5 |
| challenges.csv | 180 | 챕터당 3 도전(규칙 조합·보상) | 08 §5 |
| equipment.csv | 48 | 6슬롯 × 8원형(옵션·전설 효과·세트) | 09 §2 |
| pets.csv | 12 | 출전/지원 스킬·AI·성장·진화·각성 | 09 §4 |
| collectibles.csv | 100 | 수집품(효과 유형 stat/util/rule/econ) | 09 §5 |
| sets.csv | 20 | 세트 3/5 보너스 | 09 §5 |
| talents.csv | 84 | 특성 3분기 7티어 | 09 §6 |
| modes.csv | 8 | 상시 모드 10항목 | 10 §1 |
| events.json | 6 | 이벤트 템플릿 규칙·교환·잔여 처리·재사용 구조 | 10 §3 |
| missions.csv | 44 | 일일 24 / 주간 20 | 10 §2 |
| achievements.csv | 100 | 업적 | 10 §2 |
| rewards.csv | 69 | 드롭 테이블(확률·천장)·상점 테이블 | 11 §2 |

문서 내 상호 참조는 문서 번호(예: "12장 §9")를 사용한다. 데이터가 문서와 충돌하면 **데이터 우선**, 충돌은 구현 시 보고.

---

## 3. 문서 연결 관계

```
01 콘셉트 ── 02 조사 ── 03 대응표
    │
04 루프 ── 05 수량표
    │
06 전투 ─┬─ 07 스킬·진화·빌드 ── skills/passives/evolutions/parts/builds
         ├─ 08 챕터·적·보스 ── chapters/waves/wave_templates/challenges/enemies/bosses
         ├─ 09 성장 ── characters/equipment/parts/pets/collectibles/sets/talents
         └─ 10 모드·이벤트 ── modes/events/missions/achievements/rewards
    │
11 경제 ── 12 수식·검증 (balance.json 원천)
    │
13 화면·UX
    │
14 기술·데이터 명세·도구 ── 15 성능·아트
    │
16 개발 단계 ── 17 리스크 ── 18 구현 프롬프트 ── 19 자체 점검
```

---

## 4. 완료 범위와 미작성·후속 항목

- 완료: 위 19 문서 + 23 데이터 파일. 수량 목표(05장) 전 항목 실제 목록 작성.
- 요구대로 처리한 항목: 챕터 11~60 웨이브는 템플릿 ID + 파라미터(초 단위 표는 도구가 생성).
- 미작성(17장 §5, 19장 말미): 카카오 채널 게시물 내용(접근 불가), 시뮬레이션 실행 결과, `balance.json` 실제 파일, 효과음·BGM 개별 목록, 콘셉트 아트.
- 이어서 작업할 경우 순서: ① `balance.json` 생성(12장 값) → ② 검증기 구현 후 data/ 참조 오류 수정 → ③ 18장 프롬프트 1부터 구현.
