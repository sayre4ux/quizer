import { describe, expect, it } from 'vitest';
import { contentLang, stopEnterSpace } from './ui-utils';

describe('contentLang', () => {
  it('detects Chinese from han characters', () => {
    expect(contentLang('下面的描述中错误的是')).toBe('zh');
  });
  it('detects Japanese from kana even when han is present', () => {
    expect(contentLang('次のうち正しいものは')).toBe('ja');
  });
  it('detects Korean from hangul', () => {
    expect(contentLang('다음 중')).toBe('ko');
  });
  it('returns undefined for Latin text', () => {
    expect(contentLang('Which of the following')).toBeUndefined();
    expect(contentLang('')).toBeUndefined();
  });
  it('detects CJK mixed into mostly Latin text', () => {
    expect(contentLang('GB/T 22239-2019 第 8 条')).toBe('zh');
  });
  it('refines Chinese to the known display script, leaving ja/ko/Latin alone', () => {
    expect(contentLang('網絡安全', 'zh-Hant')).toBe('zh-Hant');
    expect(contentLang('网络安全', 'zh-Hans')).toBe('zh-Hans');
    expect(contentLang('次のうち正しいものは', 'zh-Hant')).toBe('ja');
    expect(contentLang('다음 중', 'zh-Hans')).toBe('ko');
    expect(contentLang('Which', 'zh-Hant')).toBeUndefined();
  });
});

describe('stopEnterSpace', () => {
  function run(key: string) {
    let stopped = false;
    stopEnterSpace({ key, stopPropagation: () => { stopped = true; } });
    return stopped;
  }
  it('stops Enter and Space only', () => {
    expect(run('Enter')).toBe(true);
    expect(run(' ')).toBe(true);
    expect(run('a')).toBe(false);
    expect(run('1')).toBe(false);
    expect(run('f')).toBe(false);
  });
});
