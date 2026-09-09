import type { Page } from 'playwright';
import { SELECTORS } from './selectors.ts';

// 메인페이지 Todo 팝업(인페이지 모달)에서 "온라인강의" 항목을 읽어온다.
// 항목 클릭 시 사이트 JS(goLecture)가:
//   1) /ilos/lo/st_room_auth_check2.acl 로 권한 확인
//   2) /ilos/mp/todo_list_connect.acl?SEQ=..&gubun=lecture_weeks&KJKEY=.. 로 same-tab 이동
//   3) 최종 착지: /ilos/st/course/online_list_form.acl?WEEK_NO=n  (collectLectures 가 파싱하는 그 화면)

const MAIN_URL = 'https://e-cyber.catholic.ac.kr/ilos/main/main_form.acl';
const CONNECT_URL = 'https://e-cyber.catholic.ac.kr/ilos/mp/todo_list_connect.acl';

export interface TodoItem {
  kj: string; // 과목키 (KJKEY)
  seq: string; // 차시 SEQ
  gubun: string; // 종류 (lecture_weeks = 온라인강의)
  title: string; // "[온라인강의] 2주차 1차시"
  subject: string; // "금융빅데이터실무2"
  dday: string; // "D-5"
}

async function openTodoDialog(page: Page): Promise<void> {
  if (!page.url().includes('main_form.acl')) {
    await page.goto(MAIN_URL, { waitUntil: 'domcontentloaded' });
  }
  await page.locator(SELECTORS.todoIcon).click();
  await page.locator(SELECTORS.todoDialog).waitFor({ state: 'visible', timeout: 10_000 });
  // 목록은 다이얼로그 오픈 후 AJAX(todo_list.acl)로 채워진다 — 항목이 붙을 때까지 잠깐 대기
  await page
    .locator(`${SELECTORS.todoDialog} ${SELECTORS.todoItem}`)
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => {});
}

export async function collectTodos(page: Page): Promise<TodoItem[]> {
  await openTodoDialog(page);

  // cross-origin/tsx 직렬화 이슈를 피하려 page.evaluate 대신 로케이터로만 읽는다.
  const rows = page.locator(`${SELECTORS.todoDialog} ${SELECTORS.todoItem}`);
  const count = await rows.count();
  const items: TodoItem[] = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const cls = (await row.getAttribute('class')) ?? '';
    if (cls.includes('no_data')) continue; // "조회할 자료가 없습니다" placeholder

    const onclick = (await row.getAttribute('onclick')) ?? '';
    const m = onclick.match(/goLecture\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/);
    if (!m) continue;

    const readText = async (sel: string): Promise<string> => {
      const loc = row.locator(sel).first();
      if ((await loc.count()) === 0) return '';
      return (await loc.innerText()).trim().replace(/\s+/g, ' ');
    };

    items.push({
      kj: m[1],
      seq: m[2],
      gubun: m[3],
      title: await readText('.todo_title'),
      subject: await readText('.todo_subjt'),
      dday: await readText('.todo_d_day'),
    });
  }

  return items.filter((it) => it.gubun === 'lecture_weeks' && it.kj !== '' && it.seq !== '');
}

export function todoConnectUrl(todo: TodoItem): string {
  const params = new URLSearchParams({
    SEQ: todo.seq,
    gubun: 'lecture_weeks',
    KJKEY: todo.kj,
  });
  return `${CONNECT_URL}?${params.toString()}`;
}

// Todo 항목 → 해당 주차 온라인강의 목록 페이지로 이동.
// 1차: connect URL 직접 이동(빠르고 단순). 착지가 아니면 2차: 팝업에서 항목 클릭(사이트 JS 그대로 태움).
export async function openTodoLectureList(page: Page, todo: TodoItem): Promise<void> {
  await page.goto(todoConnectUrl(todo), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  if (page.url().includes('online_list_form')) return;

  await openTodoDialog(page);
  const selector = `${SELECTORS.todoItem}[onclick*="goLecture('${todo.kj}','${todo.seq}','lecture_weeks')"]`;
  await Promise.all([
    page.waitForNavigation({ url: /online_list_form/, timeout: 30_000 }),
    page.locator(selector).click(),
  ]);
}
