# 원소 스킬 그림 — Gemini 프롬프트 (2026-09-22 밤, 기획 `docs/22_원소_스킬_체계_기획.md`)

시트 6장. 모두 **1024×1024, 4칸 × 4칸(16칸), 마젠타(#FF00FF) 단색 배경, 칸 선 없음, 글자 없음**.
칸 순서는 왼쪽 위부터 오른쪽으로, 줄이 바뀌면 다음 줄. 애니메이션은 왼쪽→오른쪽 순서.
스타일은 주인공과 같은 **두꺼운 갈색 외곽선 + 밝고 진한 색 + 흰색 하이라이트**. 흐릿한 반투명 효과 대신 또렷한 만화 이펙트.
저장 이름 그대로 `이미지 에셋/` 폴더에 넣거나 `/admin/upload`로 올려 주세요.

| 저장 이름 | 내용 |
|---|---|
| `스킬 불.png` | 불꽃병·불 웅덩이·로켓 폭죽·폭발·화산 폭탄·불꽃놀이 로켓 |
| `스킬 물.png` | 물풍선·물 튀김·물대포·물보라·왕 물풍선·무지개 물대포 |
| `스킬 바람.png` | 바람 부메랑·회오리 팽이·바람 궤적·자석 부메랑·태풍 팽이 |
| `스킬 흙.png` | 돌멩이·흙먼지·두더지 지뢰·흙 폭발·바위 굴리기·두더지 폭탄밭 |
| `스킬 번개.png` | 번개 구름·번개·찌릿 벌·전기 침·천둥 번개 구름·벌떼 |
| `지원품 아이콘.png` | 지원품 8개 아이콘 (3×3 중 8칸) |

공통 머리말(모든 프롬프트 앞에 붙임):
```
Game effect sprite sheet, 2D top-down cartoon style for a children's game, 1024x1024, solid flat magenta background (#FF00FF), NO grid lines, NO text, NO labels.
Thick dark-brown outlines, bright saturated colors, white highlights, bold readable shapes (nothing faint or translucent).
Layout: 4 columns x 4 rows = 16 cells, one object per cell, each centered and filling about 70% of its cell, nothing touching cell edges.
```

## 시트 1 — `스킬 불.png`
```
[공통 머리말]
Fire element skill effects, main color bright orange-red (#FF6A2A) with yellow and white cores:
Row 1: (1) a small glass bottle with a burning rag (molotov), tilted; (2) fire puddle animation frame A: round pool of flames seen from above, small; (3) fire puddle frame B: bigger flames; (4) fire puddle frame C: tallest flames with white tips.
Row 2: (5) a festival rocket firework (red tube, pointed tip, sparkling fuse) flying right; (6) explosion frame A: white flash ball; (7) explosion frame B: orange fireball with dark smoke edges; (8) explosion frame C: fading smoke puffs with sparks.
Row 3: (9) evolved "volcano bomb": a big black round bomb with glowing red cracks and a lit fuse; (10) lava pool frame A: round glowing red-orange lava puddle with dark crust; (11) lava pool frame B: brighter, bubbling; (12) lava pool frame C: erupting with bright splashes.
Row 4: (13) evolved "fireworks rocket": a golden rocket with a rainbow tail; (14) fireworks burst frame A: small colorful sparkles; (15) fireworks burst frame B: big star-shaped burst of red, yellow, blue sparks; (16) fireworks burst frame C: fading trails.
```

## 시트 2 — `스킬 물.png`
```
[공통 머리말]
Water element skill effects, main color bright sky-blue (#2AA8FF) with white highlights:
Row 1: (1) a round blue water balloon with a knot and white shine; (2) water splash frame A: small splash ring; (3) splash frame B: big crown-shaped splash with droplets; (4) splash frame C: scattered droplets falling.
Row 2: (5) a water cannon beam segment: a thick horizontal jet of water with white streaks (tileable left-right); (6) beam tip: the front of the jet with a spray head; (7) spray impact frame A: burst of foam; (8) spray impact frame B: wide mist and droplets.
Row 3: (9) evolved "king water balloon": a huge blue balloon with a crown and shine; (10) big splash frame A; (11) big splash frame B with tall water columns; (12) big splash frame C: wide ring wave.
Row 4: (13) evolved "rainbow water cannon" beam segment: thick jet with rainbow stripes; (14) rainbow beam tip; (15) rainbow impact frame A: bright white-blue burst; (16) rainbow impact frame B: mist with small rainbow arcs.
```

## 시트 3 — `스킬 바람.png`
```
[공통 머리말]
Wind element skill effects, main color bright mint-green (#3ED88A) with white streaks:
Row 1: (1) a wooden boomerang with green wind glow, frame A (horizontal); (2) the same boomerang rotated 45 degrees, frame B; (3) curved white-green wind trail arc; (4) small wind swirl mark (hit effect).
Row 2: (5) a small spinning tornado top seen from above, frame A: green funnel with white spiral; (6) tornado frame B: spiral rotated; (7) tornado frame C: spiral rotated further; (8) round soft shadow circle for the tornado base.
Row 3: (9) evolved "magnet boomerang": a large metallic boomerang with red-blue magnet tips and green glow, frame A; (10) the same rotated 45 degrees, frame B; (11) a green pulling line effect: a dashed glowing line with a small arrow; (12) a bright green burst (hit).
Row 4: (13) evolved "typhoon top": a big tall tornado with white rings, frame A; (14) typhoon frame B; (15) typhoon frame C; (16) a wide white wind ring seen from above (shockwave).
```

## 시트 4 — `스킬 흙.png`
```
[공통 머리말]
Earth element skill effects, main color warm brown (#C48A3F) with tan highlights:
Row 1: (1) a fist-sized rough brown stone, frame A; (2) the same stone rotated, frame B; (3) dust cloud frame A: small brown puffs; (4) dust cloud frame B: big brown dust burst with pebbles.
Row 2: (5) a mole mine: a small dirt mound with a cute mole face peeking out, frame A (eyes open); (6) the same mound, frame B (mole hiding, only mound); (7) dirt explosion frame A: mound bursting with clumps; (8) dirt explosion frame B: wide brown burst with flying pebbles.
Row 3: (9) evolved "rolling boulder": a huge round boulder with cracks, frame A; (10) the same boulder rotated, frame B; (11) boulder dust trail: brown dust cloud stretched horizontally; (12) ground crack mark (impact).
Row 4: (13) evolved "mole bomb field": a bigger dirt mound with three mole faces; (14) big dirt explosion frame A; (15) big dirt explosion frame B with rocks; (16) chain-blast ring: brown shockwave ring seen from above.
```

## 시트 5 — `스킬 번개.png`
```
[공통 머리말]
Lightning element skill effects, main color bright yellow (#FFD83A) with white cores and light purple edges:
Row 1: (1) a small dark storm cloud with an angry face and yellow glow; (2) a thick vertical lightning bolt, frame A (jagged); (3) lightning bolt frame B (different jag); (4) bright round ground flash with sparks (impact).
Row 2: (5) an electric bee: cute round yellow-black striped bee with blue electric wings, frame A (wings up); (6) the same bee, frame B (wings down); (7) an electric stinger projectile: short thick yellow bolt with sparks; (8) spark hit mark: small yellow star burst.
Row 3: (9) evolved "thunder storm cloud": a big wide dark cloud with lightning inside and yellow glowing eyes; (10) triple lightning bolts frame A; (11) triple lightning bolts frame B; (12) big ground flash ring.
Row 4: (13) evolved "bee swarm": three electric bees flying together; (14) a homing stinger with a curved yellow trail; (15) a yellow dashed homing line with an arrow; (16) a big electric burst (star with rings).
```

## 시트 6 — `지원품 아이콘.png` (3×3 중 8칸)
```
Item icon sheet, 2D cartoon style for a children's game, 1024x1024, solid flat magenta background (#FF00FF), NO grid lines, NO text.
Thick dark-brown outlines, bright colors, white highlights. Layout: 3 columns x 3 rows, one icon per cell centered, about 65% of the cell; the last cell (bottom right) stays empty.
(1) a yellow lightning battery with a bolt symbol; (2) a green magnet bracelet (horseshoe magnet on a wristband); (3) green sneakers with small wind marks; (4) a red chili pepper with flames; (5) a big blue water bottle; (6) a small glass dew bottle with a leaf and a sparkle; (7) a hearty lunch box with rice, egg and vegetables; (8) a round earth shield made of stone with a leaf emblem.
```

## 결과가 이상하게 나올 때
- 칸이 16개가 아니거나 크기가 들쭉날쭉: "Exactly 16 cells in a 4x4 layout, all objects the same scale" 을 덧붙여 다시.
- 반투명·흐릿하게 나오면: "solid, opaque, bold cartoon shapes, no glow blur, no transparency" 를 덧붙여.
- 배경에 무늬가 생기면: "completely flat plain magenta background, no shadows, no floor" 를 덧붙여.
