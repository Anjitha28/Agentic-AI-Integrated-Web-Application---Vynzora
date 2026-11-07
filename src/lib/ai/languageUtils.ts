export type SupportedLanguage = 'en' | 'ml' | 'hi';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  speechCode: string;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    speechCode: 'en-US',
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    speechCode: 'ml-IN',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    speechCode: 'hi-IN',
  },
};

/**
 * Automatically detect whether the text is Malayalam, Hindi, or English.
 * Supports native scripts (Malayalam \u0D00-\u0D7F, Devanagari \u0900-\u097F)
 * as well as Romanized Manglish and Hinglish keywords.
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || typeof text !== 'string') return 'en';

  const clean = text.trim().toLowerCase();

  // 1. Unicode script detection for Malayalam (\u0D00 - \u0D7F)
  const malayalamScriptRegex = /[\u0D00-\u0D7F]/;
  if (malayalamScriptRegex.test(clean)) {
    return 'ml';
  }

  // 2. Unicode script detection for Devanagari / Hindi (\u0900 - \u097F)
  const devanagariScriptRegex = /[\u0900-\u097F]/;
  if (devanagariScriptRegex.test(clean)) {
    return 'hi';
  }

  // Normalize words by removing punctuation
  const words = clean
    .replace(/[?!.,;:'"()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // 3. Manglish Romanized keyword detection
  const manglishKeywords = new Set([
    'ethra', 'innu', 'innathe', 'nale', 'nalathe', 'vannittundo', 'vannittund', 'vannu',
    'enquirikalkk', 'undoo', 'undu', 'undo', 'aanu', 'aano', 'ente', 'nammude',
    'parayoo', 'parayu', 'parayaamo', 'kanikku', 'kaanikku', 'kaanoo', 'evide',
    'aaru', 'aarokke', 'aaraanu', 'puthiya', 'pathu', 'onnum', 'nalku', 'samayam',
    'kollam', 'shari', 'sheriyaanu', 'ariyikku', 'reports', 'visheshangal', 'choyikku',
    'namaskaram', 'sukhamano', 'sukhamaano', 'sukham', 'nandi', 'dhanyavadam',
    'ithil', 'eathaanu', 'etavum', 'pradhaanam', 'pradhanappetta'
  ]);
  const isManglish = words.some((w) => manglishKeywords.has(w));
  if (isManglish) {
    return 'ml';
  }

  // 4. Hinglish Romanized keyword detection
  const hinglishKeywords = new Set([
    'aaj', 'aajkal', 'kal', 'parson', 'kitne', 'kitna', 'kitni', 'kaun', 'kaunsa', 'kaunsi',
    'kya', 'kaise', 'kaisa', 'kaisi', 'batao', 'bataiye', 'dikhao', 'dikhaye', 'karo',
    'kariye', 'kijiye', 'hain', 'hai', 'humein', 'hamare', 'hamari', 'naya', 'naye', 'nayi',
    'kundali', 'ginti', 'abhi', 'kripya', 'sabse', 'zyada', 'jyada', 'kam', 'chahiye',
    'madad', 'namaste', 'pranam', 'shukriya', 'dhanyawad', 'haal'
  ]);
  const isHinglish = words.some((w) => hinglishKeywords.has(w));
  if (isHinglish) {
    return 'hi';
  }

  return 'en';
}

