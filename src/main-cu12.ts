import { chromium, type Frame, type Page } from 'playwright';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import { loadConfig } from './config.ts';

const BASE = 'https://www.cu12.ac.kr';
const START_URL = process.env.CU12_START_URL ?? `${BASE}/el/main/main_form.acl`;
const LOGIN_PATH = '/el/member/login_form.acl';
const MYCOURSE_URL =`${BASE}/el/member/mycourse_list_form.acl`;
const classroomUrl = (lectureSeq: string): string => `${BASE}/el/class/todo_list_form.acl?LECTURE_SEQ=${lectureSeq}`;
// 가톨릭대 사이버캠퍼스 세션과 섞이지 않도록 별도 파일에 저장한다.
const STATE_FILE = './.auth-state-cu12.json';

interface Course {
  lectureSeq: string;
  title: string;
}

interface Lesson {
  cseq: string;
  title: string;
  completed: boolean;
}

interface PlayerState {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
}

// 직전 페이지의 이동/리다이렉트가 아직 진행 중이면 goto가 net::ERR_ABORTED로 끊길 수 있어, 잠시 기다린 뒤 재시도한다.
async function gotoWithRetry(page: Page, url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('ERR_ABORTED') || attempt >= 4) throw error;
      await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2_000);
    }
  }
}

// 나의과정에서 '진행중' 과정만 읽는다. 과정 카드: <a href="javascript:enterClass(945)">
async function collectCourses(page: Page): Promise<Course[]> {
  await gotoWithRetry(page, MYCOURSE_URL);
  await page.locator('a[href*="enterClass"]').first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});

  const raw = await page.locator('a[href*="enterClass"]').evaluateAll((anchors) =>
    anchors.map((a) => {
      let el: HTMLElement | null = a as HTMLElement;
      // 카드 전체 텍스트(진행중/종료 표시)가 나올 때까지 위로 올라간다.
      while (el && !/진행중|진행예정|종료/.test(el.innerText) && el.parentElement) el = el.parentElement;
      return {
        href: a.getAttribute('href') ?? '',
        text: (a as HTMLElement).innerText.trim(),
        card: (el?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 40),
      };
    }),
  );

  const courses = new Map<string, Course>();
  for (const r of raw) {
    const m = r.href.match(/enterClass\(\s*(\d+)\s*\)/);
    if (!m || !r.card.startsWith('진행중')) continue;
    const prev = courses.get(m[1]);
    if (!prev || (!prev.title && r.text)) courses.set(m[1], { lectureSeq: m[1], title: r.text });
  }
  return [...courses.values()];
}

// 강의실의 열려 있는(학습인정기간 시작된) 온라인강의를 읽는다. at="1.000000000" 이면 완료.
async function collectLessons(page: Page, course: Course): Promise<Lesson[]> {
  await gotoWithRetry(page, classroomUrl(course.lectureSeq));
  await page.locator('a.vod_contents').first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});

  const raw = await page.locator('a.vod_contents').evaluateAll((anchors) =>
    anchors.map((a) => ({
      cseq: a.getAttribute('cseq') ?? '',
      at: a.getAttribute('at') ?? '0',
      title: ((a.querySelector('.title') as HTMLElement | null)?.innerText ?? '').trim(),
    })),
  );
  return raw.map((r) => ({ cseq: r.cseq, title: r.title, completed: parseFloat(r.at) >= 1 }));
}

function findPlayerFrame(page: Page): Frame | undefined {
  return page.frames().find((f) => f.url().includes('/el/class/contents_vod_view.acl'));
}

async function readPlayer(frame: Frame): Promise<PlayerState | null> {
  try {
    const v = frame.locator('video').first();
    if ((await v.count()) === 0) return null;
    return await v.evaluate((el) => {
      const video = el as HTMLVideoElement;
      return {
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      };
    });
  } catch {
    return null; // 프레임 전환 중 등
  }
}

function fmt(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// 강의 페이지(contents_vod_view_form)에서 영상이 끝날 때까지 실시간 시청한다.
async function watchCurrentVideo(page: Page, isStopped: () => boolean): Promise<void> {
  let frame: Frame | undefined;
  for (let i = 0; i < 30 && !frame; i++) {
    frame = findPlayerFrame(page);
    if (!frame) await page.waitForTimeout(1_000);
  }
  if (!frame) throw new Error('플레이어 프레임을 찾지 못했습니다.');
  await frame.locator('video').first().waitFor({ state: 'attached', timeout: 30_000 });

  const startedAt = Date.now();
  let lastLogAt = 0;
  let deadline = Number.POSITIVE_INFINITY;

  while (true) {
    const st = await readPlayer(frame);
    if (st) {
      if (st.ended) return;
      if (Number.isFinite(deadline) === false && st.duration > 0) {
        deadline = startedAt + (st.duration + 300) * 1000; // 정지/버퍼링 대비 여유 5분
      }
      if (st.paused) {
        // 자동재생이 막힌 경우: 큰 재생 버튼 → 컨트롤바 재생 버튼 순으로 클릭
        const big = frame.locator('.vjs-big-play-button:visible');
        const ctl = frame.locator('.vjs-play-control.vjs-paused:visible');
        if ((await big.count()) > 0) await big.first().click({ timeout: 3_000 }).catch(() => {});
        else if ((await ctl.count()) > 0) await ctl.first().click({ timeout: 3_000 }).catch(() => {});
      }
      if (Date.now() - lastLogAt >= 30_000) {
        lastLogAt = Date.now();
        const pct = st.duration > 0 ? Math.floor((st.currentTime / st.duration) * 100) : 0;
        console.log(`  → 시청 중... ${fmt(st.currentTime)} / ${fmt(st.duration)} (${pct}%)`);
      }
    }
    if (Date.now() > deadline) throw new Error('재생 시간이 예상보다 너무 오래 걸려 중단합니다.');
    if (isStopped()) return;
    await page.waitForTimeout(3_000);
  }
}

async function main(): Promise<void> {
  // 강의 소리가 나지 않도록 매크로 브라우저 전체를 음소거한다 (재생·출석에는 영향 없음).
  const browser = await chromium.launch({ headless: false, args: ['--mute-audio'] });
  const context = await browser.newContext(
    fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : undefined,
  );
  const page = await context.newPage();
  page.on('dialog', (dialog) => {
    console.log(`  (알림창) ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.goto(START_URL);

  const rl = readline.createInterface({ input, output });
  const { loginId, loginPw } = loadConfig('cu12');

  // 메인 페이지에 로그인 링크가 없으면 저장된 세션으로 이미 로그인된 상태
  if ((await page.locator(`a[href="${LOGIN_PATH}"]`).count()) === 0) {
    console.log('[공유대학] 이미 로그인되어 있습니다.');
  } else if (loginId && loginPw) {
    console.log('[공유대학] login.txt 계정 정보로 자동 로그인합니다.');
    await gotoWithRetry(page, `${BASE}${LOGIN_PATH}`);
    await page.click('#catholic'); // "가톨릭 12개 대학 사용자" 탭에서 가톨릭대학교 선택
    await page.locator('#usr_id2').waitFor({ state: 'visible', timeout: 10_000 });
    await page.fill('#usr_id2', loginId);
    await page.fill('#pwd2', loginPw);
    await page.click('#loginBtn_check2');
    await page.waitForTimeout(3_000);
  } else {
    console.log('────────────────────────────────────');
    console.log('[공유대학] login.txt에 공유대학아이디/공유대학비밀번호를 적어두면 다음부터 자동 로그인됩니다.');
    console.log('[공유대학] 1) 브라우저에서 직접 로그인하세요 (한 번 로그인하면 다음 실행부터는 유지됩니다)');
    console.log('[공유대학] 2) 로그인이 끝나면 이 터미널에 Enter 키를 누르세요');
    console.log('────────────────────────────────────');
    await rl.question('로그인 완료 후 Enter... ');
  }
  await context.storageState({ path: STATE_FILE });

  let stopRequested = false;
  rl.on('line', (line) => {
    if (line.trim().toLowerCase() === 'q') {
      stopRequested = true;
      console.log('종료 요청됨 — 현재 강의를 마치는 대로 종료합니다.');
    }
  });
  console.log('────────────────────────────────────');
  console.log('나의과정의 진행중 과정을 자동으로 수강합니다. 중간에 멈추려면 q 를 입력하고 Enter 하세요.');
  console.log('────────────────────────────────────');

  let lastFailedKey: string | null = null;
  let consecutiveFailures = 0;
  let watched = 0;
  let aborted = false;

  // 수강할 강의가 하나도 남지 않을 때까지: 과정 → 첫 미완료 차시 시청 → 처음부터 다시 확인
  outer: while (!stopRequested) {
    await context.storageState({ path: STATE_FILE });
    const courses = await collectCourses(page);
    if (courses.length === 0) {
      console.log('진행중인 과정이 없습니다. (로그인이 풀렸다면 다시 실행해 로그인하세요)');
      break;
    }

    let target: { course: Course; lesson: Lesson } | null = null;
    for (const course of courses) {
      const lessons = await collectLessons(page, course);
      const pending = lessons.filter((l) => !l.completed);
      console.log(`[${course.title}] 열린 강의 ${lessons.length}건 — 미완료 ${pending.length}건`);
      if (pending.length > 0) {
        target = { course, lesson: pending[0] };
        break;
      }
    }
    if (!target) {
      console.log('────────────────────────────────────');
      console.log('지금 수강 가능한 강의를 모두 마쳤습니다. (아직 열리지 않은 주차는 열린 뒤 다시 실행하세요)');
      break;
    }

    const { course, lesson } = target;
    const key = `${course.lectureSeq}|${lesson.cseq}`;
    console.log('────────────────────────────────────');
    console.log(`시청 시작: ${lesson.title} — ${course.title}`);

    try {
      // 강의실 페이지에서 해당 차시 링크를 직접 클릭 (사이트 JS viewGo 그대로 사용)
      await page.locator(`a.vod_contents[cseq="${lesson.cseq}"]`).click();
      await page.waitForURL(/contents_vod_view_form/, { timeout: 30_000 });
      await watchCurrentVideo(page, () => stopRequested);
      if (!stopRequested) console.log('  → 영상 종료');
      await page.waitForTimeout(5_000); // 출석 반영 대기
    } catch (error) {
      console.error(`시청 실패: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 목록에서 완료 처리가 됐는지 확인
    const after = (await collectLessons(page, course)).find((l) => l.cseq === lesson.cseq);
    if (after?.completed) {
      watched += 1;
      lastFailedKey = null;
      consecutiveFailures = 0;
      console.log(`  → 완료 확인: ${lesson.title}`);
    } else if (!stopRequested) {
      consecutiveFailures = key === lastFailedKey ? consecutiveFailures + 1 : 1;
      lastFailedKey = key;
      console.error(`  → 아직 완료로 표시되지 않았습니다 (${consecutiveFailures}/3)`);
      if (consecutiveFailures >= 3) {
        console.error('같은 강의가 3회 연속 완료되지 않아 자동 진행을 중단합니다.');
        aborted = true;
        break outer;
      }
    }
  }

  await context.storageState({ path: STATE_FILE });
  rl.close();
  await browser.close();
  console.log(`종료했습니다. 이번 실행에서 완료한 강의: ${watched}건${aborted ? ' (오류로 중단)' : ''}`);
}

main().catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
