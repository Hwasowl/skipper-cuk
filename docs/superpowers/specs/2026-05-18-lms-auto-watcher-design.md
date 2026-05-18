# LMS 강의 자동 시청 매크로 설계서

작성일: 2026-05-18
대상: 본인이 개발 중인 모의 LMS 플랫폼의 QA 자동화 매크로

## 1. 목적

모의 LMS 플랫폼의 "강의 시청 → 출석 인정" 플로우를 자동으로 통과시키는 매크로를 만든다. 사용자가 강의 목록 페이지까지 진입한 후 매크로를 실행하면, 미완료 강의를 순차적으로 자동 시청하고 출석 처리한다.

## 2. 범위

- **포함**: 강의 목록 페이지 진입 후의 자동화 — 강의 항목 분류, 플레이어 진입, 영상 재생, 종료 감지, 출석 버튼 클릭, 다음 강의로 진행
- **제외**: 로그인 자동화, 강의 목록 페이지까지의 네비게이션, 출석 결과 검증

## 3. 기술 스택

- 언어: TypeScript (Node.js)
- 자동화 도구: Playwright (Chromium, headed 모드)
- 실행: `tsx` (TypeScript 런너)
- 환경 변수: `dotenv`

## 4. 사용 시나리오

1. 사용자가 터미널에서 `npm start` 실행
2. Playwright가 Chromium 브라우저 창을 띄움
3. 사용자가 직접 로그인하고 강의 목록 페이지(예: 11주차)까지 네비게이션
4. 터미널에서 Enter 키 입력 → 매크로 인계
5. 매크로가 페이지의 모든 강의 카드를 스캔하고 미완료 항목만 큐에 적재
6. 큐의 각 강의에 대해:
   - "학습하기" 클릭 → 플레이어 페이지 진입
   - 비디오 자동 재생 시작
   - 영상 종료까지 실시간 대기 (이어보기 시 남은 시간만 대기)
   - "출석(종료)" 클릭
   - 강의 목록 페이지로 복귀
7. 모든 강의 처리 완료 후 결과 요약 출력

## 5. 핵심 동작 규약

### 5.1 강의 항목 분류

각 강의 카드에서 진행률을 읽어 분류한다.

| 상태 | 판정 기준 | 동작 |
|---|---|---|
| 완료 | 진행률 100% 또는 ✓ 마크 | 스킵 |
| 미시청 | 진행률 0% | 큐에 추가 |
| 부분 시청 | 0% < 진행률 < 100% | 큐에 추가 (이어보기) |

### 5.2 플레이어 진입

"학습하기" 클릭 시 새 탭/팝업/같은 페이지 네비게이션 모두 가능하므로 세 가지를 동시에 처리:

```typescript
const [playerPage] = await Promise.race([
  context.waitForEvent('page'),         // 새 탭/창
  listPage.waitForEvent('popup'),       // 팝업
  listPage.waitForNavigation(),         // 같은 창
]);
```

### 5.3 비디오 시청

1. `<video>` 엘리먼트가 등장하고 `readyState >= 1` 및 `duration > 0`이 될 때까지 대기 (인트로 2~5초 자동 처리)
2. `video.play()`를 `page.evaluate`로 직접 호출 (autoplay 차단 우회)
3. `video.ended === true`까지 실시간 대기
4. 30초마다 진행률 콘솔 로그

### 5.4 출석 종료

1. 비디오 종료 감지 후 3초 안전 버퍼
2. "출석(종료)" 버튼 클릭
3. 플레이어 창 close 이벤트 또는 강의 목록 페이지 복귀 감지

## 6. 모듈 구조

```
skipper-cuk/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── .env.example
├── .gitignore
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-18-lms-auto-watcher-design.md
├── src/
│   ├── main.ts                 # 엔트리포인트
│   ├── config.ts               # 환경 설정 로드
│   ├── selectors.ts            # 모든 셀렉터 한 곳에서 관리
│   ├── lecture-list.ts         # 강의 카드 수집 및 분류
│   ├── lecture-runner.ts       # 단일 강의 시청 사이클
│   ├── video-player.ts         # 비디오 재생/종료 감지
│   └── logger.ts               # 진행 로그 출력
└── README.md
```

### 6.1 각 모듈 책임

| 모듈 | 책임 | 의존성 |
|---|---|---|
| `main.ts` | 브라우저 launch, 수동 대기, 오케스트레이션 | 모두 |
| `config.ts` | `.env` 로드, 셀렉터/타임아웃 기본값 제공 | dotenv |
| `selectors.ts` | DOM 셀렉터 상수 모음 | (없음) |
| `lecture-list.ts` | 강의 카드 수집 → `Lecture[]` 반환, 완료 항목 필터링 | playwright, selectors |
| `lecture-runner.ts` | 단일 강의 사이클 실행 (클릭→재생→종료→출석) | playwright, video-player, logger |
| `video-player.ts` | `<video>` 대기, 재생 시작, 종료 감지, 진행률 폴링 | playwright |
| `logger.ts` | 강의별 상태 콘솔 출력, 최종 요약 | (없음) |

## 7. 데이터 모델

```typescript
interface Lecture {
  index: number;          // 1차시, 2차시 ...
  title: string;          // "11주 1차시"
  duration: string;       // "42:43"
  watchedTime: string;    // "00:00" 또는 "20:00"
  progressPercent: number; // 0 ~ 100
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  studyButton: Locator;   // 클릭 대상 Playwright Locator
}

interface RunResult {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
}
```

## 8. 셀렉터 (`selectors.ts`)

플랫폼 변경 시 이 파일만 수정하면 되도록 분리:

```typescript
export const SELECTORS = {
  lectureCard: '...',           // 1차시/2차시 카드 컨테이너
  studyButton: 'text=학습하기',
  progressText: '...',          // "20:00 / 42:43" 표시 영역
  progressPercent: '...',       // "0%" 표시 영역
  endButton: 'text=출석(종료)',
  videoElement: 'video',
};
```

(실제 값은 모의 플랫폼 DOM 확인 후 채움)

## 9. 에러 처리

| 시나리오 | 동작 |
|---|---|
| 학습하기 클릭 후 플레이어 30초 내 미진입 | 해당 강의 `failed` 처리, 다음으로 이동 |
| `<video>` duration 30초 내 미확정 | 해당 강의 `failed` 처리 |
| 영상 종료 대기 중 타임아웃 (duration × 1.5 초과) | 해당 강의 `failed` 처리 |
| 출석 버튼 클릭 실패 | 해당 강의 `failed` 처리 |
| 사용자 Ctrl+C | 현재 강의 중단, 브라우저 유지 후 종료 |

## 10. 진행 로그 형식

```
[1/3] 11주 1차시 (42:43) — 시작 (이어보기 20:00부터, 22분 43초 남음)
  → 시청 중... 21:00 / 42:43 (49%)
  → 시청 중... 21:30 / 42:43 (50%)
  ...
  → 영상 종료, 출석(종료) 클릭
[2/3] 11주 2차시 (30:59) — 시작
  ...
[3/3] 11주 3차시 (57:18) — 완료(100%), 스킵

────────────────────────────────────
완료: 2건 / 스킵: 1건 / 실패: 0건
소요 시간: 1h 25m 26s
────────────────────────────────────
```

## 11. YAGNI — 의도적으로 제외하는 것

- Headless 모드 (실시간 재생이 전제이므로 사람이 화면을 볼 수 있어야 함)
- 영상 길이 추정/스킵 로직 (실시간 대기 결정 따라 불필요)
- 자동 재시도 로직 (실패 시 사용자가 수동 개입 후 재실행)
- 로그인 자동화 (사용자가 수동 처리)
- 출석 결과 검증 (별도 QA 시나리오)
- 멀티 주차 일괄 처리 (1회 실행 = 1개 주차)

## 12. 성공 기준

- 강의 목록 페이지에서 매크로 실행 시 모든 미완료 강의가 자동 시청·출석 처리됨
- 완료된 강의는 자동 스킵되어 시간 낭비 없음
- 부분 시청 강의는 이어보기 형태로 남은 시간만 대기
- 인트로 2~5초로 인한 출석 버튼 조기 클릭 사고 없음
- 매크로 실행 중 콘솔에서 진행 상황을 실시간으로 확인 가능
- 강의 1개 실패 시 다른 강의 처리에는 영향 없음
