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
| `END_BUTTON_DELAY_MS` | `3000` | 영상 종료 후 출석 버튼 클릭까지 대기 |
| `VIDEO_READY_TIMEOUT_MS` | `30000` | `<video>` duration 감지 타임아웃 |
