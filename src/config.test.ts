import { describe, it, expect } from 'vitest';
import { LOGIN_TEMPLATE, parseLoginFile } from './config.ts';

describe('parseLoginFile', () => {
  it('reads id and password (BOM, CRLF, = in password)', () => {
    expect(parseLoginFile('﻿아이디=abc\r\n비밀번호= p=w! \r\n')).toEqual({
      loginId: 'abc',
      loginPw: 'p=w!',
    });
  });

  it('treats the template and a half-filled file as missing values', () => {
    expect(parseLoginFile(LOGIN_TEMPLATE)).toEqual({ loginId: undefined, loginPw: undefined });
    expect(parseLoginFile('아이디=abc\r\n비밀번호=\r\n')).toEqual({ loginId: 'abc', loginPw: undefined });
  });
});
