import type { Page } from 'playwright';
import { SELECTORS } from './selectors.ts';

// 비디오 element가 cross-origin iframe(cms.catholic.ac.kr) 안에 있어 직접 제어 불가.
// 따라서 list 페이지에서 미리 알아낸 duration·watched 값을 기준으로 시간만큼 대기한다.

export async function waitForPlayerReady(page: Page, timeoutMs: number): Promise<void> {
  await page.locator(SELECTORS.endButton).waitFor({ state: 'visible', timeout: timeoutMs });
}

export async function waitPlaybackDuration(
  page: Page,
  remainingSeconds: number,
  durationSeconds: number,
  onProgress: (elapsedSeconds: number) => void,
): Promise<void> {
  const start = Date.now();
  const totalMs = remainingSeconds * 1000;

  while (true) {
    const elapsedMs = Date.now() - start;
    if (elapsedMs >= totalMs) return;

    const remainingMs = totalMs - elapsedMs;
    const stepMs = Math.min(30_000, remainingMs);
    await page.waitForTimeout(stepMs);

    const elapsedSeconds = Math.floor((Date.now() - start) / 1000);
    if (elapsedSeconds < remainingSeconds) {
      onProgress(elapsedSeconds);
    }
  }
}
