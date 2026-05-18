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
    const progressText = (await card.locator(SELECTORS.cardProgressText).innerText()).trim();
    const percentText = (await card.locator(SELECTORS.cardProgressPercent).innerText()).trim();

    // progressText 포맷: "20:00 / 42:43" → 두 토큰 모두 분리해 watched / duration 추출
    const [watchedRaw = '', durationRaw = ''] = progressText.split('/').map((s) => s.trim());
    const watchedSeconds = parseTimeToSeconds(watchedRaw);
    const durationSeconds = parseTimeToSeconds(durationRaw);
    const durationText = durationRaw;
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
