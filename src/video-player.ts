import type { Page } from 'playwright';
import { SELECTORS } from './selectors.ts';

// 비디오 element가 cross-origin iframe(cms.catholic.ac.kr) 안에 있어 video API 직접 호출은 불가.
// 단 Playwright의 frameLocator는 click 이벤트는 OS 레벨에서 디스패치하므로 cross-origin 환경에서도 동작.
// 따라서 재생 시작은 iframe 안 버튼 클릭으로, 종료 감지는 list 페이지의 duration·watched 시간 기반 대기로 처리한다.

export async function waitForPlayerReady(page: Page, timeoutMs: number): Promise<void> {
  await page.locator(SELECTORS.endButton).waitFor({ state: 'visible', timeout: timeoutMs });
}

export async function startVideoPlayback(page: Page): Promise<void> {
  const frame = page.frameLocator(SELECTORS.playerFrame);

  // 1) 중앙 큰 재생 오버레이가 보이면 그것을 클릭 (시청 시작 전 상태)
  const overlay = frame.locator(SELECTORS.playOverlay);
  try {
    await overlay.waitFor({ state: 'visible', timeout: 5_000 });
    await overlay.click({ timeout: 5_000 });
    return;
  } catch {
    // 오버레이가 없으면 이미 재생 중이거나 이어보기 상태 — 컨트롤 바 시도
  }

  // 2) fallback: 하단 컨트롤바 재생/일시정지 버튼
  const ctrlBtn = frame.locator(SELECTORS.playControlButton);
  try {
    await ctrlBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await ctrlBtn.click({ timeout: 5_000 });
  } catch {
    // 둘 다 실패하면 자동재생일 가능성이 높다고 보고 진행
  }
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
