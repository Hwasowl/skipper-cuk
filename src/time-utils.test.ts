import { describe, it, expect } from 'vitest';
import { parseTimeToSeconds, parsePercent, formatElapsed } from './time-utils.ts';

describe('parseTimeToSeconds', () => {
  it('parses MM:SS', () => {
    expect(parseTimeToSeconds('42:43')).toBe(42 * 60 + 43);
  });

  it('parses 0:00', () => {
    expect(parseTimeToSeconds('0:00')).toBe(0);
  });

  it('parses HH:MM:SS', () => {
    expect(parseTimeToSeconds('1:23:45')).toBe(3600 + 23 * 60 + 45);
  });

  it('returns NaN for invalid input', () => {
    expect(parseTimeToSeconds('invalid')).toBeNaN();
  });
});

describe('parsePercent', () => {
  it('parses "47%" to 47', () => {
    expect(parsePercent('47%')).toBe(47);
  });

  it('parses "0%" to 0', () => {
    expect(parsePercent('0%')).toBe(0);
  });

  it('parses "100%" to 100', () => {
    expect(parsePercent('100%')).toBe(100);
  });

  it('ignores surrounding whitespace', () => {
    expect(parsePercent('  47%  ')).toBe(47);
  });

  it('returns NaN for invalid input', () => {
    expect(parsePercent('done')).toBeNaN();
  });
});

describe('formatElapsed', () => {
  it('formats seconds-only', () => {
    expect(formatElapsed(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(60 + 30)).toBe('1m 30s');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatElapsed(3600 + 60 + 30)).toBe('1h 1m 30s');
  });

  it('formats 0 as "0s"', () => {
    expect(formatElapsed(0)).toBe('0s');
  });
});
