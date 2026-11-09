import type { Page } from 'playwright';
import type { Config } from './config.ts';
import { waitForAuthCode } from './gmail-auth-code.ts';

const codeInput = (n: number): string => `#secondary_auth_confirm_input_auth_code_word_${n}`;

// 학습하기를 누르면 뜨는 2차 본인인증(이메일) 창을 처리한다. 창이 떴으면 true, 안 떴으면 false.
export async function handleSecondaryAuth(page: Page, config: Config): Promise<boolean> {
  const emailOption = page.getByText('이메일 인증').first();
  const shown = await emailOption.waitFor({ state: 'visible', timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  if (!shown) return false;

  if (!config.gmailUser || !config.gmailAppPassword) {
    console.log('  2차 인증 창이 떴습니다. 브라우저에서 직접 인증하세요.');
    console.log('  (.env에 GMAIL_USER / GMAIL_APP_PASSWORD를 넣으면 자동으로 처리합니다)');
    await waitForManualAuth(page);
    return true;
  }

  console.log('  2차 인증 — 이메일로 인증번호 요청, Gmail 확인 중...');
  const requestedAt = new Date();
  await emailOption.click();

  const code = await waitForAuthCode(config.gmailUser, config.gmailAppPassword, requestedAt).catch((error) => {
    console.error(`  Gmail 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (!code) {
    console.log('  인증번호 메일을 찾지 못했습니다. 브라우저에서 직접 인증하세요.');
    await waitForManualAuth(page);
    return true;
  }

  for (const [i, digit] of [...code].entries()) {
    await page.fill(codeInput(i + 1), digit);
  }
  await page.getByText('확인', { exact: true }).click();
  await page.locator(codeInput(1)).waitFor({ state: 'hidden', timeout: 15_000 });
  console.log('  2차 인증 완료');
  return true;
}

// 사용자가 직접 인증해 인증 창(선택지·입력칸)이 사라질 때까지 최대 10분 기다린다.
async function waitForManualAuth(page: Page): Promise<void> {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const open =
      (await page.getByText('이메일 인증').first().isVisible()) || (await page.locator(codeInput(1)).isVisible());
    if (!open) return;
    await page.waitForTimeout(2_000);
  }
  throw new Error('2차 인증이 10분 안에 완료되지 않았습니다');
}
