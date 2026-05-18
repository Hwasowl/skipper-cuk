import 'dotenv/config';

export interface Config {
  startUrl: string;
  endButtonDelayMs: number;
  videoReadyTimeoutMs: number;
}

export function loadConfig(): Config {
  return {
    startUrl: process.env.START_URL ?? 'about:blank',
    endButtonDelayMs: Number(process.env.END_BUTTON_DELAY_MS ?? 3000),
    videoReadyTimeoutMs: Number(process.env.VIDEO_READY_TIMEOUT_MS ?? 30_000),
  };
}
