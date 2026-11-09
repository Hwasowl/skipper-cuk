import { describe, it, expect } from 'vitest';
import { LOGIN_TEMPLATE, parseLoginFile } from './config.ts';

describe('parseLoginFile', () => {
  it('reads key=value lines (BOM, CRLF, = in password)', () => {
    expect(parseLoginFile(String.fromCharCode(0xfeff) + '아이디=abc\r\n비밀번호= p=w! \r\n')).toEqual({
      아이디: 'abc',
      비밀번호: 'p=w!',
    });
  });

  it('treats the blank template as empty', () => {
    expect(parseLoginFile(LOGIN_TEMPLATE)).toEqual({});
  });

  it('keeps each site and the Google account separate', () => {
    const text = [
      '아이디=a',
      '비밀번호=pa',
      '공유대학아이디=b',
      '공유대학비밀번호=pb',
      '# 주석=무시',
      '구글계정=me@gmail.com',
      '구글앱비밀번호=abcd efgh',
    ].join('\n');
    expect(parseLoginFile(text)).toEqual({
      아이디: 'a',
      비밀번호: 'pa',
      공유대학아이디: 'b',
      공유대학비밀번호: 'pb',
      구글계정: 'me@gmail.com',
      구글앱비밀번호: 'abcd efgh',
    });
  });
});
