# 서호팡팡수호대 1-1~1-5 개편 구현

성장·친구·장비·자동 합체·선물과 서버 이용권 정책을 포함한 실행 소스입니다.

- 게임: https://seoho-pangpang.seoho-pangpang-server.workers.dev/
- 기존 관리자: https://seoho-pangpang.seoho-pangpang-server.workers.dev/admin/
- 상세 변경·이전·검증·운영 지침: `docs/GUARDIAN_V1_HANDOFF.md`
- 실제 리소스와 재생성 지침: `docs/GUARDIAN_V1_RESOURCES.md`
- 파일별 크기/검증 값: `resource-manifest.json`

기본 이용권은 한국 시간 오전 8시에 10장으로 초기화됩니다. 성공 시 1장, 실패 시 0장입니다. 미션/선물 지급은 없고 기존 관리자만 추가분을 지급할 수 있습니다.

Node 24 사용. `cd server`에서 `npm ci`, 저장소 루트에서 `npm run build`, `npm test`를 실행하세요. 자세한 로컬 D1 시험과 배포 방법은 인수인계를 참고하세요. 관리자 열쇠·로컬 DB·학생 데이터·node_modules는 묶음에 없습니다.

이전 CSV와 옛 문서는 역사 기록입니다. 개편 규칙의 실제 기준은 `game/src/rework-core.js`, `rework-content.js`입니다. 배포 전 다른 작업의 최신 변경을 확인하고 합치세요.
