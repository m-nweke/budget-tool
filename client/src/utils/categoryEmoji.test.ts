import { describe, it, expect } from 'vitest';
import { emojiForLabel, emojiForOutflow } from './categoryEmoji';

describe('emojiForLabel', () => {
  it('matches a category name against a known keyword', () => {
    expect(emojiForLabel('Groceries')).toBe('🍎');
  });

  it('matches case-insensitively', () => {
    expect(emojiForLabel('MORTGAGE')).toBe('🏠');
  });

  it('matches a keyword inside a longer merchant label', () => {
    expect(emojiForLabel('Trader Joe\'s Groceries')).toBe('🍎');
  });

  it('falls back to the default tag emoji when nothing matches', () => {
    expect(emojiForLabel('Netflix')).toBe('🏷️');
  });

  it('prefers the more specific "day care" keyword over the broader "care" substring it contains', () => {
    // "care" itself isn't a listed keyword, but this pins the documented
    // ordering intent (specific-before-broad) so a future broad "care"
    // addition can't silently shadow "day care" by landing earlier in the list.
    expect(emojiForLabel('Day care tuition')).toBe('🧸');
  });

  it('returns the first matching keyword when a label contains multiple', () => {
    // "rent" appears before "gym" in KEYWORD_EMOJI — order, not string
    // position, decides the winner.
    expect(emojiForLabel('Gym membership and rent reminder')).toBe('🏠');
  });
});

describe('emojiForOutflow', () => {
  it('uses a keyword match over the source fallback when both are available', () => {
    expect(emojiForOutflow('Electric Bill', 'bill')).toBe('💡');
  });

  it('falls back to the source emoji when the label has no keyword match', () => {
    expect(emojiForOutflow('Netflix', 'bill')).toBe('🧾');
  });

  it('falls back per-source correctly for each outflow source', () => {
    expect(emojiForOutflow('Acme Corp', 'recurring_transaction')).toBe('🔁');
    expect(emojiForOutflow('Chase Sapphire', 'debt')).toBe('💳');
    expect(emojiForOutflow('Vanguard', 'investment')).toBe('📈');
  });
});
