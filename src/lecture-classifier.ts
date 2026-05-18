export interface LectureProgress {
  progressPercent: number;
  watchedSeconds: number;
  durationSeconds: number;
}

export type LectureStatus = 'completed' | 'partial' | 'pending';

export function classifyLecture(p: LectureProgress): LectureStatus {
  if (p.progressPercent >= 100 || p.watchedSeconds >= p.durationSeconds) {
    return 'completed';
  }
  if (p.progressPercent <= 0 && p.watchedSeconds <= 0) {
    return 'pending';
  }
  return 'partial';
}
