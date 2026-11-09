import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// 사이버캠퍼스 2차 본인인증 메일: 보낸 사람 cyber@catholic.ac.kr, 본문 "인증번호 1234"
const SENDER = 'cyber@catholic.ac.kr';
// PC와 메일 서버 시계 차이를 감안해 요청 시각보다 조금 이전 메일까지 허용한다.
const CLOCK_SKEW_MS = 60_000;

// 메일 HTML에서 "인증번호" 바로 뒤의 4자리를 뽑는다 (날짜 등 다른 4자리 숫자는 무시).
export function extractAuthCode(html: string): string | undefined {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return text.match(/인증번호\s*(\d{4})(?!\d)/)?.[1];
}

// requestedAt 이후 도착한 가장 최근 인증메일의 번호를 기다려 반환한다. 시간 안에 못 찾으면 undefined.
export async function waitForAuthCode(
  user: string,
  appPassword: string,
  requestedAt: Date,
  timeoutMs = 120_000,
): Promise<string | undefined> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass: appPassword.replace(/\s/g, '') }, // 구글이 보여주는 띄어쓰기 형태도 허용
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = requestedAt.getTime() - CLOCK_SKEW_MS;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await client.noop(); // 새로 도착한 메일 반영
      // IMAP SINCE는 날짜 단위라 시각 비교는 아래 internalDate로 한다.
      const uids = (await client.search({ from: SENDER, since: requestedAt }, { uid: true })) || [];
      const newest = Math.max(0, ...uids);
      if (newest > 0) {
        const msg = await client.fetchOne(String(newest), { source: true, internalDate: true }, { uid: true });
        if (msg && msg.source && new Date(msg.internalDate ?? 0).getTime() >= since) {
          const parsed = await simpleParser(msg.source);
          const code = extractAuthCode(parsed.html || parsed.text || '');
          if (code) return code;
        }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
    return undefined;
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
}
