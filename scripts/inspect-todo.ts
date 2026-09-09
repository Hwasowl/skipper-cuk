import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';

// Todo 팝업 구조 조사용 일회성 스크립트.
// 사용법: npx tsx scripts/inspect-todo.ts
//  1) 브라우저가 열리면 (필요 시) 로그인하고 메인페이지 상태로 둔다
//  2) 터미널에 Enter → 로그인 세션 저장
//  3) 브라우저에서 직접 Todo 아이콘을 클릭한다
//  4) 스크립트가 새로 뜨는 팝업 창 / 새 탭 / 인페이지 요소를 감지해 HTML을 덤프한다

const STATE_FILE = './.auth-state.json';
const OUT_DIR = './scripts/out';

async function dumpPage(tag: string, page: import('playwright').Page): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    const url = page.url();
    const html = await page.content();
    const file = `${OUT_DIR}/${tag}.html`;
    fs.writeFileSync(file, `<!-- URL: ${url} -->\n${html}`);
    console.log(`  [${tag}] ${url}`);
    console.log(`  → 저장: ${file} (${html.length.toLocaleString()} bytes)`);

    // 프레임 목록도 출력 (팝업이 iframe을 품고 있을 수 있음)
    const frames = page.frames();
    if (frames.length > 1) {
      console.log(`  프레임 ${frames.length}개:`);
      for (const f of frames) console.log(`    - ${f.url()}`);
    }
  } catch (e) {
    console.log(`  [${tag}] 덤프 실패:`, e);
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(
    fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : undefined,
  );

  // 새로 열리는 모든 페이지(팝업/새탭) 감지
  context.on('page', async (p) => {
    console.log('\n>>> 새 페이지(팝업/탭) 감지됨');
    await p.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await dumpPage(`popup-${Date.now()}`, p);
    console.log('\n조사가 끝나면 터미널에 Enter를 눌러 종료하세요.');
  });

  const page = await context.newPage();
  await page.goto('https://e-cyber.catholic.ac.kr/ilos/main/main_form.acl');

  const rl = readline.createInterface({ input, output });

  await rl.question(
    '\n로그인하고 메인페이지를 띄운 상태에서 Enter를 누르세요 (세션 저장)... ',
  );
  await context.storageState({ path: STATE_FILE });
  console.log('세션 저장 완료.\n');

  // 메인페이지 상단 영역 스냅샷 — Todo 아이콘 후보를 찾기 위해 헤더 HTML을 미리 저장
  await dumpPage('main', page);
  const headerHtml = await page
    .locator('body')
    .evaluate((el) => {
      // 아이콘/뱃지가 있을 법한 상단 영역만 추리기 어려우니 전체 저장은 main.html이 담당.
      // 여기선 'todo' 문자열이 들어간 요소를 훑어 후보를 뽑는다.
      const hits: string[] = [];
      el.querySelectorAll('*').forEach((n) => {
        const s = (n.getAttribute('onclick') || '') + ' ' + (n.getAttribute('href') || '') + ' ' + (n.className || '') + ' ' + (n.id || '');
        if (/todo/i.test(s)) hits.push(`<${n.tagName.toLowerCase()}> ${s.trim().slice(0, 200)}`);
      });
      return hits.join('\n');
    })
    .catch(() => '');
  if (headerHtml) {
    console.log('메인페이지에서 "todo" 관련 요소 후보:');
    console.log(headerHtml);
    console.log('');
  }

  console.log('────────────────────────────────────');
  console.log('이제 브라우저에서 직접 Todo 아이콘을 클릭하세요.');
  console.log('팝업이 새 창/새 탭으로 뜨면 자동으로 HTML을 저장합니다.');
  console.log('만약 팝업이 같은 페이지 안(모달)에 뜬다면, 그 상태로 터미널에 Enter를 누르세요 — 현재 페이지를 다시 덤프합니다.');
  console.log('────────────────────────────────────');

  await rl.question('팝업을 띄운 뒤 Enter... ');

  // 인페이지 모달 케이스: 현재 페이지 상태를 다시 저장
  await dumpPage('main-after-click', page);

  // 열려있는 모든 페이지도 저장
  for (const [i, p] of context.pages().entries()) {
    await dumpPage(`page-${i}`, p);
  }

  await rl.question('\n완료. Enter를 누르면 브라우저를 닫습니다... ');
  rl.close();
  await browser.close();
  console.log('\n저장된 파일:', fs.readdirSync(OUT_DIR).join(', '));
}

main().catch((e) => {
  console.error('오류:', e);
  process.exit(1);
});
