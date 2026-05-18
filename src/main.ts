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
