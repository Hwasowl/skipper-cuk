import { formatElapsed } from './time-utils.ts';

export interface RunResult {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
}

export class Logger {
  startLecture(idx: number, total: number, title: string, durationText: string, resumeText?: string): void {
    const suffix = resumeText ? ` (이어보기 ${resumeText})` : '';
    console.log(`[${idx}/${total}] ${title} (${durationText}) — 시작${suffix}`);
  }

  progress(currentText: string, durationText: string, percent: number): void {
    console.log(`  → 시청 중... ${currentText} / ${durationText} (${percent}%)`);
  }

  endingLecture(): void {
    console.log(`  → 영상 종료, 출석(종료) 클릭`);
  }

  skipped(idx: number, total: number, title: string, reason: string): void {
    console.log(`[${idx}/${total}] ${title} — 스킵 (${reason})`);
  }

  failed(idx: number, total: number, title: string, error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${idx}/${total}] ${title} — 실패: ${msg}`);
  }

  summary(result: RunResult): void {
    console.log('────────────────────────────────────');
    console.log(`완료: ${result.completed}건 / 스킵: ${result.skipped}건 / 실패: ${result.failed}건`);
    console.log(`소요 시간: ${formatElapsed(Math.floor(result.elapsedMs / 1000))}`);
    console.log('────────────────────────────────────');
  }
}
