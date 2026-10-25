
import { describe, expect, it } from 'vitest';

import type { BhashiniTurn } from '@/types/phase7_contracts';
import { formatBhashiniTurn } from '@/lib/bhashini/ulca-client';

describe('Phase 7 BHASHINI turn formatting', () => {
  it('preserves source language, target language, and original text', () => {
    const turn: BhashiniTurn = formatBhashiniTurn({
      sourceLang: 'ta',
      targetLang: 'en',
      originalText: 'ஒரு எண்ணை மாற்று',
      translatedText: 'Swap one number',
      asrConfidence: 0.91,
    });
    expect(turn.source_lang).toBe('ta');
    expect(turn.target_lang).toBe('en');
    expect(turn.original_text).toBe('ஒரு எண்ணை மாற்று');
    expect(turn.translated_text).toBe('Swap one number');
  });
});
