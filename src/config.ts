import 'dotenv/config';

export interface Config {
  startUrl: string;
  endButtonDelayMs: number;
  playerReadyTimeoutMs: number;
  extraWaitSeconds: number;
}

export function loadConfig(): Config {
  return {
    startUrl: process.env.START_URL ?? 'https://e-cyber.catholic.ac.kr/ilos/main/main_form.acl',
    endButtonDelayMs: Number(process.env.END_BUTTON_DELAY_MS ?? 3000),
    playerReadyTimeoutMs: Number(process.env.PLAYER_READY_TIMEOUT_MS ?? 30_000),
    extraWaitSeconds: Number(process.env.EXTRA_WAIT_SECONDS ?? 60),
  };
}
