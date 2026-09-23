# 실제 포함된 리소스

이번 구현에는 제작 예정 파일 이름만 넣은 자리가 없다. 게임에서 참조하는 새 친구 6종과 아이콘 20종을 실제로 포함했다. 전체 파일과 SHA-256은 `resource-manifest.json`을 참고한다.

## 새로 생성한 친구 그림

OpenAI 내장 이미지 생성 도구로 개별 생성한 투명 RGBA PNG, 각 1254×1254이다. 게임이 표시 크기에 맞춰 렌더링한다. 배경 제거·리사이즈로 원본을 변형하지 않았다.

경로: `game/assets/seoho_v1/pets/{cat,turtle,otter,sparrow,deer,seal}_idle.png`

공통 재생성 지침:

> ONE friendly animal companion for a Korean elementary school environmental cleanup browser game. A readable 2.5-head chibi silhouette, thick soft charcoal outline, flat warm colors with simple two-tone cel shading. Three-quarter view facing right, full body centered with 15 percent padding, recognizable at 48 pixels. True transparent background. No floor, shadow, glow, lettering, frame or extra characters. 1254 by 1254 PNG.

| 파일 | 개별 묘사 |
|---|---|
| cat_idle.png | 주황과 흰색 고양이, 잎사귀 목수건, 새싹을 모아 주는 밝은 표정 |
| turtle_idle.png | 연두 거북이, 잎 모양 등껍질, 낮고 튼튼한 체형, 순한 미소 |
| otter_idle.png | 갈색과 크림색 수달, 파란 물방울 소품, 동그란 코와 작은 발 |
| sparrow_idle.png | 갈색 참새, 밝은 배, 짧은 날개를 활짝 펴는 도우미 |
| deer_idle.png | 작은 황갈색 사슴, 크림색 배와 흰 반점, 부드러운 귀, 새싹 장식 |
| seal_idle.png | 밝은 회색과 크림색 아기 물범, 통통한 몸, 물빛 장식, 둥근 지느러미 |

이 표는 새 변형을 만들기 위한 재생성 프롬프트 지침이다. 기존 Gemini 생성 주인공/환경 그림의 출처를 새로 생성한 것으로 바꾸지 않는다.

## 코드로 직접 만든 그래픽

`tools/create-icons.mjs`가 SVG 20개를 만든다. 물총·집게·빗자루·바람개비·씨앗·물통·손잡이·태양·바람·이용권·선물·코인·하트·옷·신발·지도·도감·방패·반짝임·화살표를 포함한다. 구체적 파일명은 manifest에 있다.

물방울·집게·씨앗 투사체, 바람개비 회전과 합체 연출은 Canvas로 그린다. 원본과 진화에 별도 프레임 이미지가 필수인 구조가 아니다. 친구는 공통 이동/둥실 애니메이션을 사용한다.

## 기존 리소스 유지

호야·민지 프레임, 시작 화면, 첫 마을 바닥 3종·적·보스·환경 소품·아이템, Kenney 효과음/보조 이미지, 폰트는 기존 배포를 유지한다. 최신 운영의 정화/연기/물방울 VFX PNG 3개와 `theme-effects.js`도 함께 보존했다. 기존 출처는 `share/ASSET_CREDITS.md`와 `share/effects-update.md`의 해당 기록을 참고한다. 그 문서의 옛 미구현 목록은 현재 범위를 설명하는 것이 아니다.

보스 예고 원은 실제 충돌 반경을 축소하지 않는다. 운영 이펙트의 모션 줄이기 설정 대응도 유지한다. 새 PNG 6종은 투명 채널이 있는지 확인했고, 실제 브라우저에서 리소스 로드 오류가 없는지 점검했다.
