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
