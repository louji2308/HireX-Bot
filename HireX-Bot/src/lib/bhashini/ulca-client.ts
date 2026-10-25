import type { BhashiniTurn } from '@/types/phase7_contracts';

export function formatBhashiniTurn(input: {
  readonly sourceLang: 'ta' | 'hi' | 'te' | 'kn' | 'bn' | 'mr' | 'en';
  readonly targetLang: 'ta' | 'hi' | 'te' | 'kn' | 'bn' | 'mr' | 'en';
  readonly originalText: string;
  readonly translatedText: string;
  readonly asrConfidence: number | null;
}): BhashiniTurn {
  return {
    source_lang: input.sourceLang,
    target_lang: input.targetLang,
    original_text: input.originalText,
    translated_text: input.translatedText,
    asr_confidence: input.asrConfidence,
  };
}
