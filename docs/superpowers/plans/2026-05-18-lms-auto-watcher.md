# LMS 강의 자동 시청 매크로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모의 LMS 플랫폼의 강의 목록 페이지에서 미완료 강의를 자동으로 시청하고 출석 처리하는 Playwright 매크로를 구축한다.

**Architecture:** Playwright(Chromium, headed)로 브라우저를 띄우고 사용자가 수동 로그인·페이지 진입 후 매크로가 인계받아 강의 카드를 분류·순차 처리한다. 순수 로직(시간 파싱, 분류, 포맷)은 TDD로 검증하고, 브라우저 자동화 부분은 수동 스모크 테스트로 검증한다.

**Tech Stack:** TypeScript / Node.js / Playwright / Vitest / tsx / dotenv

---

## File Structure

```
skipper-cuk/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── README.md
├── docs/superpowers/
│   ├── specs/2026-05-18-lms-auto-watcher-design.md
│   └── plans/2026-05-18-lms-auto-watcher.md
└── src/
    ├── main.ts                     # 엔트리포인트
    ├── config.ts                   # 환경 변수 + 타임아웃 기본값
    ├── selectors.ts                # DOM 셀렉터 상수
    ├── time-utils.ts               # 시간 파싱·포맷 (pure)
    ├── time-utils.test.ts
    ├── lecture-classifier.ts       # 강의 분류 (pure)
    ├── lecture-classifier.test.ts
    ├── logger.ts                   # 진행 로그 출력
    ├── lecture-list.ts             # 강의 카드 수집
    ├── video-player.ts             # <video> 재생/종료 감지
    └── lecture-runner.ts           # 단일 강의 시청 사이클
```

**모듈 책임:**
- 순수 모듈(`time-utils`, `lecture-classifier`)은 Vitest로 단위 테스트
- 브라우저 자동화 모듈(`lecture-list`, `video-player`, `lecture-runner`)은 수동 스모크 테스트 (실 플랫폼 대상)
- `selectors.ts`는 단순 상수 모음 — 모의 플랫폼 DOM 확정 시 실제 값으로 교체

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: `package.json` 생성**

`package.json`:
```json
{
  "name": "skipper-cuk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "playwright": "^1.49.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: `tsconfig.json` 생성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `vitest.config.ts` 생성**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: `.gitignore` 생성**

`.gitignore`:
```
node_modules/
.env
*.log
playwright-report/
test-results/
.vscode/
.idea/
```

- [ ] **Step 5: `.env.example` 생성**

`.env.example`:
```
# 매크로 실행 시 브라우저가 열리는 초기 URL (생략 시 about:blank)
START_URL=

# 비디오 종료 후 출석 버튼 클릭 전 안전 버퍼(ms)
END_BUTTON_DELAY_MS=3000

# 비디오 duration 감지 타임아웃(ms)
VIDEO_READY_TIMEOUT_MS=30000
```

- [ ] **Step 6: 의존성 설치**

Run: `npm install`
Expected: `node_modules/`, `package-lock.json` 생성. 에러 없음.

- [ ] **Step 7: Playwright 브라우저 다운로드**

Run: `npx playwright install chromium`
Expected: Chromium 다운로드 완료 메시지.

- [ ] **Step 8: 커밋**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "프로젝트 스캐폴드: TypeScript + Playwright + Vitest 환경 구성"
```

---

### Task 2: 시간 유틸 모듈 (TDD)

**Files:**
- Create: `src/time-utils.test.ts`
- Create: `src/time-utils.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/time-utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseTimeToSeconds, parsePercent, formatElapsed } from './time-utils.ts';

describe('parseTimeToSeconds', () => {
  it('parses MM:SS', () => {
    expect(parseTimeToSeconds('42:43')).toBe(42 * 60 + 43);
  });

  it('parses 0:00', () => {
    expect(parseTimeToSeconds('0:00')).toBe(0);
  });

  it('parses HH:MM:SS', () => {
    expect(parseTimeToSeconds('1:23:45')).toBe(3600 + 23 * 60 + 45);
  });

  it('returns NaN for invalid input', () => {
    expect(parseTimeToSeconds('invalid')).toBeNaN();
  });
});

describe('parsePercent', () => {
  it('parses "47%" to 47', () => {
    expect(parsePercent('47%')).toBe(47);
  });

  it('parses "0%" to 0', () => {
    expect(parsePercent('0%')).toBe(0);
  });

  it('parses "100%" to 100', () => {
    expect(parsePercent('100%')).toBe(100);
  });

  it('ignores surrounding whitespace', () => {
    expect(parsePercent('  47%  ')).toBe(47);
  });

  it('returns NaN for invalid input', () => {
    expect(parsePercent('done')).toBeNaN();
  });
});

describe('formatElapsed', () => {
  it('formats seconds-only', () => {
    expect(formatElapsed(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(60 + 30)).toBe('1m 30s');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatElapsed(3600 + 60 + 30)).toBe('1h 1m 30s');
  });

  it('formats 0 as "0s"', () => {
    expect(formatElapsed(0)).toBe('0s');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './time-utils.ts'` 또는 함수 미정의 에러.

- [ ] **Step 3: 최소 구현**

`src/time-utils.ts`:
```typescript
export function parseTimeToSeconds(text: string): number {
  const parts = text.trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

export function parsePercent(text: string): number {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return NaN;
  return Number(match[1]);
}

export function formatElapsed(seconds: number): string {
  if (seconds === 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(' ');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 모든 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/time-utils.ts src/time-utils.test.ts
git commit -m "time-utils: 시간/퍼센트 파싱과 경과시간 포맷 추가"
```

---

### Task 3: 강의 분류 모듈 (TDD)

**Files:**
- Create: `src/lecture-classifier.test.ts`
- Create: `src/lecture-classifier.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lecture-classifier.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { classifyLecture, type LectureProgress } from './lecture-classifier.ts';

describe('classifyLecture', () => {
  it('classifies 100% as completed', () => {
    const progress: LectureProgress = { progressPercent: 100, watchedSeconds: 2563, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('completed');
  });

  it('classifies 0% as pending', () => {
    const progress: LectureProgress = { progressPercent: 0, watchedSeconds: 0, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('pending');
  });

  it('classifies 47% as partial', () => {
    const progress: LectureProgress = { progressPercent: 47, watchedSeconds: 1200, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('partial');
  });

  it('treats watched===duration as completed even if percent is 99', () => {
    const progress: LectureProgress = { progressPercent: 99, watchedSeconds: 2563, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('completed');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './lecture-classifier.ts'`.

- [ ] **Step 3: 최소 구현**

`src/lecture-classifier.ts`:
```typescript
export interface LectureProgress {
  progressPercent: number;
  watchedSeconds: number;
  durationSeconds: number;
}

export type LectureStatus = 'completed' | 'partial' | 'pending';

export function classifyLecture(p: LectureProgress): LectureStatus {
  if (p.progressPercent >= 100 || p.watchedSeconds >= p.durationSeconds) {
    return 'completed';
  }
  if (p.progressPercent <= 0 && p.watchedSeconds <= 0) {
    return 'pending';
  }
  return 'partial';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 모든 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/lecture-classifier.ts src/lecture-classifier.test.ts
git commit -m "lecture-classifier: 진행률 기반 강의 상태 분류 추가"
```

---

### Task 4: 셀렉터 상수 모듈

**Files:**
- Create: `src/selectors.ts`

- [ ] **Step 1: 셀렉터 상수 작성**

`src/selectors.ts`:
```typescript
// 모의 LMS 플랫폼의 DOM 확정 후 실제 값으로 교체할 것.
// 기본값은 화면 캡처에서 관찰된 텍스트 기준 가정.
export const SELECTORS = {
  lectureCard: '[data-lecture-card]',
  cardTitle: '[data-lecture-title]',
  cardDuration: '[data-lecture-duration]',
  cardProgressText: '[data-lecture-progress-text]',
  cardProgressPercent: '[data-lecture-progress-percent]',
  studyButton: 'text=학습하기',
  endButton: 'text=출석(종료)',
  videoElement: 'video',
} as const;
```

- [ ] **Step 2: 커밋**

```bash
git add src/selectors.ts
git commit -m "selectors: 강의 카드/플레이어 DOM 셀렉터 상수 정의"
```

---

### Task 5: 설정 로더

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: 환경 변수 로더 작성**

`src/config.ts`:
```typescript
import 'dotenv/config';

export interface Config {
  startUrl: string;
  endButtonDelayMs: number;
  videoReadyTimeoutMs: number;
}

export function loadConfig(): Config {
  return {
    startUrl: process.env.START_URL ?? 'about:blank',
    endButtonDelayMs: Number(process.env.END_BUTTON_DELAY_MS ?? 3000),
    videoReadyTimeoutMs: Number(process.env.VIDEO_READY_TIMEOUT_MS ?? 30_000),
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/config.ts
git commit -m "config: .env 기반 설정 로더 추가"
```

---

### Task 6: 로거 모듈

**Files:**
- Create: `src/logger.ts`

- [ ] **Step 1: 로거 작성**

`src/logger.ts`:
```typescript
import { formatElapsed } from './time-utils.ts';

export interface RunResult {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
}

export class Logger {
  startLecture(idx: number, total: number, title: string, durationText: string, resumeText?: string): void {
    const suffix = resumeText ? ` (이어보기 ${resumeText})` : '';
    console.log(`[${idx}/${total}] ${title} (${durationText}) — 시작${suffix}`);
  }

  progress(currentText: string, durationText: string, percent: number): void {
    console.log(`  → 시청 중... ${currentText} / ${durationText} (${percent}%)`);
  }

  endingLecture(): void {
    console.log(`  → 영상 종료, 출석(종료) 클릭`);
  }

  skipped(idx: number, total: number, title: string, reason: string): void {
    console.log(`[${idx}/${total}] ${title} — 스킵 (${reason})`);
  }

  failed(idx: number, total: number, title: string, error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${idx}/${total}] ${title} — 실패: ${msg}`);
  }

  summary(result: RunResult): void {
    console.log('────────────────────────────────────');
    console.log(`완료: ${result.completed}건 / 스킵: ${result.skipped}건 / 실패: ${result.failed}건`);
    console.log(`소요 시간: ${formatElapsed(Math.floor(result.elapsedMs / 1000))}`);
    console.log('────────────────────────────────────');
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/logger.ts
git commit -m "logger: 강의별 시작/진행/종료/요약 출력기 추가"
```

---

### Task 7: 강의 목록 수집 모듈

**Files:**
- Create: `src/lecture-list.ts`

- [ ] **Step 1: 강의 카드 수집 함수 작성**

`src/lecture-list.ts`:
```typescript
import type { Locator, Page } from 'playwright';
import { SELECTORS } from './selectors.ts';
import { parseTimeToSeconds, parsePercent } from './time-utils.ts';
import { classifyLecture, type LectureStatus } from './lecture-classifier.ts';

export interface Lecture {
  index: number;
  title: string;
  durationText: string;
  durationSeconds: number;
  watchedText: string;
  watchedSeconds: number;
  progressPercent: number;
  status: LectureStatus;
  studyButton: Locator;
}

export async function collectLectures(page: Page): Promise<Lecture[]> {
  const cards = page.locator(SELECTORS.lectureCard);
  const count = await cards.count();
  const lectures: Lecture[] = [];

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const title = (await card.locator(SELECTORS.cardTitle).innerText()).trim();
    const durationText = (await card.locator(SELECTORS.cardDuration).innerText()).trim();
    const progressText = (await card.locator(SELECTORS.cardProgressText).innerText()).trim();
    const percentText = (await card.locator(SELECTORS.cardProgressPercent).innerText()).trim();

    // progressText 포맷: "20:00 / 42:43" → 첫 토큰만 떼어 watched 추출
    const [watchedRaw] = progressText.split('/').map((s) => s.trim());
    const watchedSeconds = parseTimeToSeconds(watchedRaw);
    const durationSeconds = parseTimeToSeconds(durationText);
    const progressPercent = parsePercent(percentText);

    const status = classifyLecture({ progressPercent, watchedSeconds, durationSeconds });

    lectures.push({
      index: i + 1,
      title,
      durationText,
      durationSeconds,
      watchedText: watchedRaw,
      watchedSeconds,
      progressPercent,
      status,
      studyButton: card.locator(SELECTORS.studyButton),
    });
  }

  return lectures;
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/lecture-list.ts
git commit -m "lecture-list: 강의 목록 페이지에서 카드 정보·상태 수집"
```

---

### Task 8: 비디오 플레이어 모듈

**Files:**
- Create: `src/video-player.ts`

- [ ] **Step 1: 비디오 제어 함수 작성**

`src/video-player.ts`:
```typescript
import type { Page } from 'playwright';
import { SELECTORS } from './selectors.ts';

export interface VideoInfo {
  duration: number;
  currentTime: number;
}

export async function waitForVideoReady(page: Page, timeoutMs: number): Promise<VideoInfo> {
  await page.waitForFunction(
    (sel) => {
      const v = document.querySelector(sel) as HTMLVideoElement | null;
      return !!v && v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0;
    },
    SELECTORS.videoElement,
    { timeout: timeoutMs },
  );

  return await page.evaluate((sel) => {
    const v = document.querySelector(sel) as HTMLVideoElement;
    return { duration: v.duration, currentTime: v.currentTime };
  }, SELECTORS.videoElement);
}

export async function startPlayback(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const v = document.querySelector(sel) as HTMLVideoElement;
    void v.play();
  }, SELECTORS.videoElement);
}

export async function waitUntilEnded(
  page: Page,
  duration: number,
  onProgress: (currentTime: number) => void,
): Promise<void> {
  const overallTimeoutMs = Math.max(60_000, Math.floor(duration * 1.5 * 1000));
  const start = Date.now();

  while (true) {
    const state = await page.evaluate((sel) => {
      const v = document.querySelector(sel) as HTMLVideoElement | null;
      if (!v) return null;
      return { currentTime: v.currentTime, ended: v.ended, duration: v.duration };
    }, SELECTORS.videoElement);

    if (!state) throw new Error('비디오 엘리먼트가 사라졌습니다');
    if (state.ended || state.currentTime >= state.duration - 0.5) return;

    onProgress(state.currentTime);

    if (Date.now() - start > overallTimeoutMs) {
      throw new Error(`비디오 종료 대기 타임아웃 (${Math.floor(overallTimeoutMs / 1000)}s 초과)`);
    }

    await page.waitForTimeout(30_000);
  }
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/video-player.ts
git commit -m "video-player: <video> 준비 대기·재생 시작·종료 감지 추가"
```

---

### Task 9: 단일 강의 사이클 모듈

**Files:**
- Create: `src/lecture-runner.ts`

- [ ] **Step 1: 사이클 함수 작성**

`src/lecture-runner.ts`:
```typescript
import type { BrowserContext, Page } from 'playwright';
import type { Config } from './config.ts';
import type { Lecture } from './lecture-list.ts';
import type { Logger } from './logger.ts';
import { SELECTORS } from './selectors.ts';
import { startPlayback, waitForVideoReady, waitUntilEnded } from './video-player.ts';

export async function runLecture(
  context: BrowserContext,
  listPage: Page,
  lecture: Lecture,
  total: number,
  config: Config,
  logger: Logger,
): Promise<void> {
  const resumeText = lecture.watchedSeconds > 0 ? lecture.watchedText : undefined;
  logger.startLecture(lecture.index, total, lecture.title, lecture.durationText, resumeText);

  const playerPage = await openPlayer(context, listPage, lecture);
  try {
    const info = await waitForVideoReady(playerPage, config.videoReadyTimeoutMs);
    await startPlayback(playerPage);

    await waitUntilEnded(playerPage, info.duration, (currentTime) => {
      const percent = Math.floor((currentTime / info.duration) * 100);
      const currentText = formatCurrentTime(currentTime);
      logger.progress(currentText, lecture.durationText, percent);
    });

    logger.endingLecture();
    await playerPage.waitForTimeout(config.endButtonDelayMs);
    await playerPage.click(SELECTORS.endButton);

    await waitForPlayerClose(playerPage, listPage);
  } finally {
    if (!playerPage.isClosed()) {
      await playerPage.close().catch(() => {});
    }
  }
}

async function openPlayer(
  context: BrowserContext,
  listPage: Page,
  lecture: Lecture,
): Promise<Page> {
  const popupPromise = listPage.waitForEvent('popup', { timeout: 30_000 }).catch(() => null);
  const newPagePromise = context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
  const navigationPromise = listPage.waitForNavigation({ timeout: 30_000 }).catch(() => null);

  await lecture.studyButton.click();

  const playerPage = (await Promise.race([popupPromise, newPagePromise, navigationPromise.then(() => listPage)])) as Page | null;
  if (!playerPage) throw new Error('학습하기 클릭 후 플레이어 페이지를 찾지 못했습니다');
  return playerPage;
}

async function waitForPlayerClose(playerPage: Page, listPage: Page): Promise<void> {
  if (playerPage === listPage) {
    await listPage.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    return;
  }
  await playerPage.waitForEvent('close', { timeout: 30_000 }).catch(() => {});
}

function formatCurrentTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/lecture-runner.ts
git commit -m "lecture-runner: 학습하기 클릭→재생→출석종료 단일 사이클 구현"
```

---

### Task 10: 엔트리포인트

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: 메인 오케스트레이터 작성**

`src/main.ts`:
```typescript
import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig } from './config.ts';
import { collectLectures } from './lecture-list.ts';
import { runLecture } from './lecture-runner.ts';
import { Logger, type RunResult } from './logger.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (config.startUrl !== 'about:blank') {
    await page.goto(config.startUrl);
  }

  console.log('────────────────────────────────────');
  console.log('1) 브라우저에서 직접 로그인하세요');
  console.log('2) 강의 목록 페이지(원하는 주차)로 이동하세요');
  console.log('3) 준비되면 이 터미널에 Enter 키를 누르세요');
  console.log('────────────────────────────────────');

  const rl = readline.createInterface({ input, output });
  await rl.question('준비되면 Enter를 누르세요... ');
  rl.close();

  const lectures = await collectLectures(page);
  const targets = lectures.filter((l) => l.status !== 'completed');
  const completedCount = lectures.length - targets.length;

  console.log(`강의 ${lectures.length}건 발견 — 시청 대상 ${targets.length}건, 이미 완료 ${completedCount}건`);

  const result: RunResult = {
    total: lectures.length,
    completed: 0,
    skipped: completedCount,
    failed: 0,
    elapsedMs: 0,
  };

  const startedAt = Date.now();
  for (const lecture of targets) {
    try {
      await runLecture(context, page, lecture, targets.length, config, logger);
      result.completed += 1;
    } catch (error) {
      logger.failed(lecture.index, targets.length, lecture.title, error);
      result.failed += 1;
    }
  }
  result.elapsedMs = Date.now() - startedAt;

  logger.summary(result);

  // 브라우저는 사용자가 확인할 수 있도록 자동 종료하지 않음
  console.log('브라우저는 열린 상태로 유지됩니다. 직접 닫아주세요.');
}

main().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
```

- [ ] **Step 2: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 빌드/실행 가능성 검증**

Run: `npx tsx --check src/main.ts` (가능하면) 또는 `npx tsx src/main.ts` 후 즉시 Ctrl+C
Expected: 모듈 로딩 에러 없이 브라우저 창이 뜸. Enter 입력 대기 화면까지 확인 후 종료.

- [ ] **Step 4: 커밋**

```bash
git add src/main.ts
git commit -m "main: 브라우저 launch·수동 인계·강의 순차 실행 오케스트레이터"
```

---

### Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: README 작성**

`README.md`:
```markdown
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
```

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "README: 설치/사용/셀렉터 갱신 가이드 추가"
```

---

### Task 12: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm test`
Expected: 모든 단위 테스트 PASS (time-utils, lecture-classifier).

- [ ] **Step 2: 타입체크 전체 실행**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 매크로 부트 확인**

Run: `npm start`
Expected:
- Chromium 창이 뜸
- 터미널에 "준비되면 Enter를 누르세요..." 표시
- Ctrl+C로 정상 종료

브라우저 창에서 강의 목록 페이지가 없으니 Enter는 누르지 않는다 (실 플랫폼 연동은 Task 후 별도 검증).

- [ ] **Step 4: 변경사항 없음 확인**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Self-Review

**Spec coverage:**
- 강의 분류 (완료/부분/미시청) → Task 3, 7
- 플레이어 진입 (팝업/새탭/같은창) → Task 9
- 비디오 종료 감지 → Task 8
- 인트로 처리 (duration > 0 대기) → Task 8
- 부분 시청 이어보기 → Task 7, 8 (currentTime에서 자연 시작)
- 안전 버퍼 후 출석 클릭 → Task 9
- 진행 로그 → Task 6
- 셀렉터 분리 → Task 4
- 환경 변수 → Task 5

**Type consistency:**
- `Lecture` 인터페이스(Task 7) → `lecture-runner`(Task 9), `main`(Task 10)에서 동일하게 사용
- `LectureProgress` / `LectureStatus`(Task 3) → `lecture-list`(Task 7)에서 동일하게 사용
- `Config`(Task 5) → `main`(Task 10), `lecture-runner`(Task 9)에서 동일하게 사용
- `RunResult`(Task 6) → `main`(Task 10)에서 동일하게 사용

**Placeholder scan:**
- `selectors.ts`의 셀렉터 값은 의도된 placeholder — 모의 플랫폼 DOM 확정 시 교체. spec에도 명시됨.
- 그 외 TBD/TODO/"적절히 처리" 없음.

**Scope:**
- 단일 매크로, 단일 실행 계획으로 처리 가능한 범위.
