import 'dotenv/config';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export interface Config {
  startUrl: string;
  endButtonDelayMs: number;
  playerReadyTimeoutMs: number;
  extraWaitSeconds: number;
  loginId?: string;
  loginPw?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
}

export type Site = 'ecyber' | 'cu12';

// 계정 정보는 모두 메모장으로 고치는 login.txt 한 곳에 둔다.
const LOGIN_FILE = 'login.txt';

// 사이트별 아이디/비밀번호 키와 안내용 이름
const SITE_KEYS = {
  ecyber: { name: '가톨릭대 사이버캠퍼스', id: '아이디', pw: '비밀번호' },
  cu12: { name: '가톨릭공유대학', id: '공유대학아이디', pw: '공유대학비밀번호' },
} as const;

export const LOGIN_TEMPLATE = [
  '# [가톨릭대 사이버캠퍼스] start-auto.bat 자동 로그인 (선택, 비워두면 브라우저에서 직접 로그인)',
  '아이디=',
  '비밀번호=',
  '',
  '# [가톨릭공유대학 cu12] start-cu12-auto.bat 자동 로그인 (선택, 비워두면 브라우저에서 직접 로그인)',
  '공유대학아이디=',
  '공유대학비밀번호=',
  '',
  '# [구글 계정] 2차 인증 메일 자동 입력 (선택, 비워두면 인증 창에서 직접 인증)',
  '# 비밀번호 칸에는 구글 "앱 비밀번호" 16자리를 적으세요.',
  '구글계정=',
  '구글앱비밀번호=',
  '',
].join('\r\n');

export function loadConfig(site: Site = 'ecyber'): Config {
  // *-auto.bat만 LOGIN_FILE을 넘긴다. 없으면(deprecated/start.bat 등) 로그인은 수동, 2차 인증용 구글 계정만 사용.
  const autoLoginFile = process.env.LOGIN_FILE;
  const login = autoLoginFile ? readLoginFileUntilFilled(autoLoginFile, site) : {};
  const file = fs.existsSync(LOGIN_FILE) ? parseLoginFile(fs.readFileSync(LOGIN_FILE, 'utf8')) : {};
  return {
    startUrl: process.env.START_URL ?? 'https://e-cyber.catholic.ac.kr/ilos/main/main_form.acl',
    endButtonDelayMs: Number(process.env.END_BUTTON_DELAY_MS ?? 3000),
    playerReadyTimeoutMs: Number(process.env.PLAYER_READY_TIMEOUT_MS ?? 30_000),
    extraWaitSeconds: Number(process.env.EXTRA_WAIT_SECONDS ?? 60),
    ...login,
    // 비어 있으면 2차 인증 창이 뜰 때 사용자가 직접 인증할 때까지 기다린다.
    gmailUser: file['구글계정'],
    gmailAppPassword: file['구글앱비밀번호'],
  };
}

// 해당 사이트 계정을 읽는다. 둘 다 비어 있으면 수동 로그인({}),
// 하나만 적혀 있으면 둘 다 채워질 때까지 메모장으로 login.txt를 열어 입력받는다.
function readLoginFileUntilFilled(file: string, site: Site): { loginId?: string; loginPw?: string } {
  const keys = SITE_KEYS[site];
  if (!fs.existsSync(file)) fs.writeFileSync(file, LOGIN_TEMPLATE);
  while (true) {
    const values = parseLoginFile(fs.readFileSync(file, 'utf8'));
    const loginId = values[keys.id];
    const loginPw = values[keys.pw];
    if (loginId && loginPw) return { loginId, loginPw };
    if (!loginId && !loginPw) return {};
    console.log('────────────────────────────────────');
    console.log(`${file}의 [${keys.name}] ${keys.id}와 ${keys.pw}를 모두 입력하세요. (직접 로그인하려면 둘 다 비우세요)`);
    console.log('메모장에서 = 뒤에 적고 저장한 뒤 메모장을 닫으면 계속 진행합니다.');
    console.log('────────────────────────────────────');
    const result = spawnSync('notepad', [file]); // 메모장을 닫을 때까지 대기
    if (result.error) throw new Error(`메모장을 열 수 없습니다: ${result.error.message}`);
  }
}

// "키=값" 줄들을 { 키: 값 }으로 읽는다. 빈 값과 # 주석 줄은 건너뛴다.
export function parseLoginFile(text: string): Record<string, string | undefined> {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // 메모장이 붙이는 BOM 제거
  const values: Record<string, string | undefined> = {};
  for (const line of body.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (line.trim().startsWith('#') || eq < 0) continue;
    // 비밀번호에 '='가 들어갈 수 있으니 첫 '=' 뒤 전체를 값으로 쓴다
    const value = line.slice(eq + 1).trim();
    if (value) values[line.slice(0, eq).trim()] = value;
  }
  return values;
}
