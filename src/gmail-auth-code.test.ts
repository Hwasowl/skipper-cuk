import { describe, it, expect } from 'vitest';
import { extractAuthCode } from './gmail-auth-code.ts';

describe('extractAuthCode', () => {
  it('reads the 4 digits after 인증번호, ignoring other numbers', () => {
    const html =
      '<p>2026년 11월 9일</p><h2>2차 본인인증</h2><div><span>인증번호</span>&nbsp;<strong>3115</strong></div>' +
      '<p>안내된 인증번호를 인증화면의 입력란에 입력해 주세요.</p>';
    expect(extractAuthCode(html)).toBe('3115');
  });

  it('returns undefined when there is no code', () => {
    expect(extractAuthCode('<p>안내된 인증번호를 입력해 주세요.</p>')).toBeUndefined();
  });
});
