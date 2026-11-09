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
}

export const LOGIN_TEMPLATE = '아이디=\r\n비밀번호=\r\n';

export function loadConfig(): Config {
  // *-auto.bat만 LOGIN_FILE(login.txt)을 넘긴다. 일반 start.bat은 항상 수동 로그인.
  const loginFile = process.env.LOGIN_FILE;
  return {
    startUrl: process.env.START_URL ?? 'https://e-cyber.catholic.ac.kr/ilos/main/main_form.acl',
    endButtonDelayMs: Number(process.env.END_BUTTON_DELAY_MS ?? 3000),
    playerReadyTimeoutMs: Number(process.env.PLAYER_READY_TIMEOUT_MS ?? 30_000),
    extraWaitSeconds: Number(process.env.EXTRA_WAIT_SECONDS ?? 60),
    ...(loginFile ? readLoginFileUntilFilled(loginFile) : {}),
  };
}

// 아이디·비밀번호가 둘 다 채워질 때까지 메모장으로 login.txt를 열어 입력받는다.
function readLoginFileUntilFilled(file: string): { loginId: string; loginPw: string } {
  if (!fs.existsSync(file)) fs.writeFileSync(file, LOGIN_TEMPLATE);
  while (true) {
    const { loginId, loginPw } = parseLoginFile(fs.readFileSync(file, 'utf8'));
    if (loginId && loginPw) return { loginId, loginPw };
    console.log('────────────────────────────────────');
    console.log(`${file}에 아이디와 비밀번호를 모두 입력하세요.`);
    console.log('메모장에서 = 뒤에 적고 저장한 뒤 메모장을 닫으면 계속 진행합니다.');
    console.log('────────────────────────────────────');
    const result = spawnSync('notepad', [file]); // 메모장을 닫을 때까지 대기
    if (result.error) throw new Error(`메모장을 열 수 없습니다: ${result.error.message}`);
  }
}

// "아이디=..." / "비밀번호=..." 줄을 읽는다. 값이 비어 있으면 undefined.
export function parseLoginFile(text: string): { loginId?: string; loginPw?: string } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/); // 메모장이 붙이는 BOM 제거
  const get = (key: string): string | undefined => {
    const line = lines.find((l) => l.trim().startsWith(`${key}=`));
    // 비밀번호에 '='가 들어갈 수 있으니 첫 '=' 뒤 전체를 값으로 쓴다
    return line?.slice(line.indexOf('=') + 1).trim() || undefined;
  };
  return { loginId: get('아이디'), loginPw: get('비밀번호') };
}
