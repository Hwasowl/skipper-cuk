import { chromium, type BrowserContext, type Page } from 'playwright';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import { loadConfig, type Config } from './config.ts';
import { collectLectures } from './lecture-list.ts';
import { runLecture } from './lecture-runner.ts';
import { collectTodos, openTodoLectureList } from './todo-list.ts';
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

  console.log('────────────────────────────────────');
  console.log('1) 브라우저에서 직접 로그인하세요 (한 번 로그인하면 다음 실행부터는 유지됩니다)');
  console.log('2) 로그인이 끝나면 이 터미널에 Enter 키를 누르세요');
  console.log('────────────────────────────────────');
  await rl.question('로그인 완료 후 Enter... ');
  await context.storageState({ path: STATE_FILE });

  // 반복 루프: Todo의 첫 번째 온라인강의 → 해당 주차 목록 페이지 시청 → Enter로 다음, q로 종료.
  let first = true;
  while (true) {
    if (!first) {
      console.log('────────────────────────────────────');
      const answer = (await rl.question('다음 강의로 진행하려면 Enter / 종료하려면 q : '))
        .trim()
        .toLowerCase();
      if (answer === 'q') break;
    }
    first = false;

    // 직전 시청으로 갱신된 세션 쿠키 저장
    await context.storageState({ path: STATE_FILE });

    const todos = await collectTodos(page);
    if (todos.length === 0) {
      console.log('Todo에 남은 온라인강의가 없습니다.');
      break;
    }

    const todo = todos[0];
    console.log('────────────────────────────────────');
    console.log(`Todo 첫 항목: ${todo.title} — ${todo.subject} (${todo.dday})`);

    try {
      await openTodoLectureList(page, todo);
    } catch (error) {
      console.error(`이동 실패: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (!page.url().includes('online_list_form')) {
      console.error(`예상과 다른 페이지입니다: ${page.url()}`);
      continue;
    }

    const result: RunResult = { total: 0, completed: 0, skipped: 0, failed: 0, elapsedMs: 0 };
    const startedAt = Date.now();
    await watchListPage(context, page, config, logger, result);
    result.elapsedMs = Date.now() - startedAt;
    logger.summary(result);

    await context.storageState({ path: STATE_FILE });
  }

  // 종료 전 최신 세션 저장
  await context.storageState({ path: STATE_FILE });
  rl.close();
  await browser.close();
  console.log('종료했습니다. 로그인 정보는 .auth-state.json에 저장되어 다음 실행 때 재사용됩니다.');
}

// 현재 page가 온라인강의 목록 페이지라는 전제하에, 미완료 강의를 순차 시청하고 결과를 acc에 누적한다.
async function watchListPage(
  context: BrowserContext,
  page: Page,
  config: Config,
  logger: Logger,
  acc: RunResult,
): Promise<void> {
  const lectures = await collectLectures(page);
  const targets = lectures.filter((l) => l.status !== 'completed');
  const completedCount = lectures.length - targets.length;

  console.log(
    `강의 ${lectures.length}건 발견 — 시청 대상 ${targets.length}건, 이미 완료 ${completedCount}건`,
  );

  acc.total += lectures.length;
  acc.skipped += completedCount;

  for (const lecture of targets) {
    try {
      await runLecture(context, page, lecture, targets.length, config, logger);
      acc.completed += 1;
    } catch (error) {
      logger.failed(lecture.index, targets.length, lecture.title, error);
      acc.failed += 1;
    }
  }
}

main().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
