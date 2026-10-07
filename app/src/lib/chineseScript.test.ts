import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetConvertersForTests,
  conversionFor,
  detectBankScript,
  ensureConverterLoaded,
  scriptConverter,
} from './chineseScript';

const SIMPLIFIED = ['这是关于网络安全的测试题，说明对时间的要求。'];
const TRADITIONAL = ['這是關於網絡安全的測試題，說明對時間的要求。'];

afterEach(() => __resetConvertersForTests());

describe('detectBankScript — tags', () => {
  it('maps zh script/region tags case-insensitively', () => {
    for (const tag of ['zh-Hans', 'zh-CN', 'zh-SG', 'ZH-HANS', 'zh_cn', 'zh-Hans-HK']) {
      expect(detectBankScript(tag, []), tag).toBe('hans');
    }
    for (const tag of ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-hant', 'zh-Hant-CN']) {
      expect(detectBankScript(tag, []), tag).toBe('hant');
    }
  });

  it('a decisive tag wins over the text', () => {
    expect(detectBankScript('zh-Hant', SIMPLIFIED)).toBe('hant');
    expect(detectBankScript('zh-Hans', TRADITIONAL)).toBe('hans');
  });

  it('bare zh, free text, other languages and no tag fall through to the text', () => {
    for (const tag of ['zh', '中文', 'en', 'English', undefined]) {
      expect(detectBankScript(tag, SIMPLIFIED), String(tag)).toBe('hans');
      expect(detectBankScript(tag, TRADITIONAL), String(tag)).toBe('hant');
    }
  });
});

describe('detectBankScript — heuristic', () => {
  it('English text is not Chinese', () => {
    expect(detectBankScript('en', ['Which of the following is BEST?', 'A firewall'])).toBeNull();
    expect(detectBankScript(undefined, [])).toBeNull();
  });

  it('too little signal is undetermined', () => {
    expect(detectBankScript(undefined, ['这们来说'])).toBeNull(); // 4 hits < 5
    // Shared han characters carry no signal either way.
    expect(detectBankScript(undefined, ['信息安全管理中的方法与原则'])).toBeNull();
  });

  it('a mixed signal below 3:1 is undetermined', () => {
    expect(detectBankScript(undefined, ['这们来说对', '這們來說'])).toBeNull(); // 5 vs 4
    expect(detectBankScript(undefined, ['这们来说对时会为与', '這們來'])).toBe('hans'); // 9 vs 3
  });

  it('an English bank with Chinese explanations reads as Chinese', () => {
    expect(detectBankScript('en', ['Which protocol encrypts web traffic?', 'TLS', 'TLS 为传输层提供加密，保护网络通信的机密性。'])).toBe('hans');
  });

  it('Japanese text is not Chinese, but a stray middle dot is', () => {
    expect(detectBankScript(undefined, ['次のうち正しいものはどれですか。会社の説明について', '時間'])).toBeNull();
    expect(detectBankScript(undefined, ['PDCA・这是关于网络安全的测试'])).toBe('hans');
  });
});

describe('scriptConverter', () => {
  it('conversionFor only converts across scripts', () => {
    expect(conversionFor('hans', 'traditional')).toBe('toHant');
    expect(conversionFor('hant', 'simplified')).toBe('toHans');
    expect(conversionFor('hans', 'simplified')).toBeNull();
    expect(conversionFor('hant', 'traditional')).toBeNull();
    expect(conversionFor('hans', 'original')).toBeNull();
    expect(conversionFor(null, 'traditional')).toBeNull();
  });

  it('is the identity, ready, for a non-Chinese bank, the original preference or a matching script', () => {
    const s = '网络安全';
    for (const [script, pref, lang] of [
      [null, 'traditional', undefined],
      ['hans', 'original', 'zh-Hans'],
      ['hans', 'simplified', 'zh-Hans'],
      ['hant', 'traditional', 'zh-Hant'],
    ] as const) {
      const c = scriptConverter(script, pref);
      expect(c.ready).toBe(true);
      expect(c.lang).toBe(lang);
      expect(c.convert(s)).toBe(s);
    }
  });

  it('is the identity with the original lang until the converter has loaded', () => {
    const c = scriptConverter('hans', 'traditional');
    expect(c.ready).toBe(false);
    expect(c.failed).toBe(false);
    expect(c.lang).toBe('zh-Hans');
    expect(c.convert('网络安全')).toBe('网络安全');
  });

  it('converts Simplified to standard Traditional glyphs, keeping mainland vocabulary', async () => {
    await ensureConverterLoaded('toHant');
    const c = scriptConverter('hans', 'traditional');
    expect(c.ready).toBe(true);
    expect(c.lang).toBe('zh-Hant');
    expect(c.convert('网络安全')).toBe('網絡安全');
    expect(c.convert('这')).toBe('這');
    expect(c.convert('软件')).toBe('軟件'); // not the Taiwan term 軟體
    expect(c.convert('信息')).toBe('信息'); // not 資訊
    expect(c.convert('头发')).toBe('頭髮'); // phrase table resolves one-to-many characters
    // Memoized: the same result again.
    expect(c.convert('网络安全')).toBe('網絡安全');
  });

  it('passes Latin text through unchanged', async () => {
    await ensureConverterLoaded('toHant');
    const c = scriptConverter('hans', 'traditional');
    const en = 'Which of the following BEST describes TLS 1.3? (A) / [B] — "C"';
    expect(c.convert(en) === en).toBe(true);
    expect(c.convert('')).toBe('');
  });

  it('converts Traditional to Simplified for a Traditional bank', async () => {
    await ensureConverterLoaded('toHans');
    const c = scriptConverter('hant', 'simplified');
    expect(c.lang).toBe('zh-Hans');
    expect(c.convert('網絡安全這軟件')).toBe('网络安全这软件');
  });
});

describe('scriptConverter — load failure', () => {
  afterEach(() => {
    vi.doUnmock('opencc-js/core');
    vi.resetModules();
  });

  it('reports failure, stays the identity, and retries on the next request', async () => {
    vi.resetModules();
    let calls = 0;
    vi.doMock('opencc-js/core', () => {
      calls += 1;
      throw new Error('offline');
    });
    const fresh = await import('./chineseScript');
    await expect(fresh.ensureConverterLoaded('toHant')).rejects.toThrow();
    const c = fresh.scriptConverter('hans', 'traditional');
    expect(c).toMatchObject({ ready: false, failed: true, lang: 'zh-Hans' });
    expect(c.convert('网络')).toBe('网络');
    await expect(fresh.ensureConverterLoaded('toHant')).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
