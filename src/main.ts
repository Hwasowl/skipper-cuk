import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import { loadConfig } from './config.ts';
import { collectLectures } from './lecture-list.ts';
import { runLecture } from './lecture-runner.ts';
import { Logger, type RunResult } from './logger.ts';

// 로그인 세션(쿠키)을 저장해 재실행 시 재로그인을 피하는 파일
// LMS 인증은 만료일 없는 '세션 쿠키'라, persistent profile은 닫으면 소멸한다.
// storageState는 세션 쿠키까지 보존하므로 이 방식만 재로그인을 막을 수 있다.
const STATE_FILE = './.auth-state.json';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(
    fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : undefined,
  );
  const page = await context.newPage();

  if (config.startUrl !== 'about:blank') {
    await page.goto(config.startUrl);
  }

  const rl = readline.createInterface({ input, output });

  let first = true;
  while (true) {
    console.log('────────────────────────────────────');
    if (first) {
      console.log('1) 브라우저에서 직접 로그인하세요 (한 번 로그인하면 다음 실행부터는 유지됩니다)');
      console.log('2) 강의 목록 페이지(원하는 주차)로 이동하세요');
      console.log('3) 준비되면 이 터미널에 Enter 키를 누르세요');
    } else {
      console.log('다음 주차로 이동한 뒤 Enter를 누르면 이어서 시청합니다');
      console.log('종료하려면 q 를 입력하고 Enter를 누르세요');
    }
    console.log('────────────────────────────────────');

    const answer = (await rl.question(first ? '준비되면 Enter를 누르세요... ' : 'Enter=계속 / q=종료 : ')).trim().toLowerCase();
    if (!first && answer === 'q') break;
    first = false;

    // 로그인 직후(그리고 직전 시청으로 갱신된) 세션 쿠키를 저장
    await context.storageState({ path: STATE_FILE });

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
  }

  // 종료 전 최신 세션 저장
  await context.storageState({ path: STATE_FILE });
  rl.close();
  await browser.close();
  console.log('종료했습니다. 로그인 정보는 .auth-state.json에 저장되어 다음 실행 때 재사용됩니다.');
}

main().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
