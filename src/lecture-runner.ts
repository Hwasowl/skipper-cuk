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
