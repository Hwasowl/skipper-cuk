import { describe, it, expect } from 'vitest';
import { classifyLecture, type LectureProgress } from './lecture-classifier.ts';

describe('classifyLecture', () => {
  it('classifies 100% as completed', () => {
    const progress: LectureProgress = { progressPercent: 100, watchedSeconds: 2563, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('completed');
  });

  it('classifies 0% as pending', () => {
    const progress: LectureProgress = { progressPercent: 0, watchedSeconds: 0, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('pending');
  });

  it('classifies 47% as partial', () => {
    const progress: LectureProgress = { progressPercent: 47, watchedSeconds: 1200, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('partial');
  });

  it('treats watched===duration as completed even if percent is 99', () => {
    const progress: LectureProgress = { progressPercent: 99, watchedSeconds: 2563, durationSeconds: 2563 };
    expect(classifyLecture(progress)).toBe('completed');
  });
});
