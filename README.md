# skipper-cuk

모의 LMS 플랫폼의 강의 시청·출석 플로우를 자동화하는 QA 매크로.

## 요구사항

- Node.js 20+
- Playwright용 Chromium (`npx playwright install chromium`)

## 설치

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

## 사용

```bash
npm start
```

1. Chromium 창이 뜨면 직접 로그인한다
2. 시청할 주차의 강의 목록 페이지까지 네비게이션
3. 터미널에서 Enter 키 입력
4. 매크로가 미완료 강의를 자동 시청·출석 처리
5. 종료 후 브라우저는 자동으로 닫히지 않음 (직접 닫아주세요)

## 테스트

```bash
npm test
```

순수 로직(시간 파싱, 강의 분류) 단위 테스트만 포함. 브라우저 자동화 부분은 모의 플랫폼에서 수동 검증.

## 셀렉터 갱신

모의 LMS의 DOM 구조에 맞춰 `src/selectors.ts`만 수정하면 됩니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `START_URL` | `about:blank` | 브라우저 시작 URL |
| `END_BUTTON_DELAY_MS` | `3000` | 시청 완료 후 출석(종료) 버튼 클릭 전 버퍼(ms) |
| `PLAYER_READY_TIMEOUT_MS` | `30000` | 플레이어 페이지 로드 대기 타임아웃(ms) |
| `EXTRA_WAIT_SECONDS` | `60` | 영상 duration 외에 더 기다릴 시간(초) — 인트로·로딩 여유 |

## 동작 방식

비디오 element는 실제 LMS에서 cross-origin iframe(cms.catholic.ac.kr) 안에 있어 직접 제어가 어렵습니다. 따라서 매크로는 다음 방식으로 동작:

1. 강의 목록 페이지에서 각 카드의 진행률(`0:00 / 42:43` + `0%`)을 파싱
2. 학습하기 클릭 → 플레이어 페이지 로드(`#close_` 노출) 대기
3. `(duration - watched) + EXTRA_WAIT_SECONDS` 만큼 실시간 대기
4. `#close_` 클릭 → 강의 목록 페이지로 복귀
