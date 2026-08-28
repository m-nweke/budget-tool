// Emoji-first iconography (design doc premise 6: "zero cost, no external
// dependency"). Matches by keyword against a category/merchant/bill label —
// no new DB column, no per-tenant configuration to migrate. A future pass
// can make this user-editable or add real merchant logos (see design doc
// Next Steps); this is the zero-backend-change baseline.
//
// Order matters: first matching keyword wins, so more specific terms
// (e.g. "day care") are listed before broader ones (e.g. "care").
const KEYWORD_EMOJI: [string, string][] = [
  ['mortgage', '🏠'],
  ['rent', '🏠'],
  ['grocery', '🍎'],
  ['groceries', '🍎'],
  ['dining', '🍹'],
  ['restaurant', '🍹'],
  ['coffee', '☕'],
  ['pet', '🐾'],
  ['vet', '🐾'],
  ['subscription', '📺'],
  ['streaming', '📺'],
  ['utilit', '💡'],
  ['electric', '💡'],
  ['gas', '⛽'],
  ['water', '🚰'],
  ['internet', '🌐'],
  ['phone', '📱'],
  ['childcare', '🧸'],
  ['day care', '🧸'],
  ['transport', '🚗'],
  ['car', '🚗'],
  ['auto', '🚗'],
  ['insurance', '🛡️'],
  ['health', '🩺'],
  ['medical', '🩺'],
  ['gym', '🏋️'],
  ['fitness', '🏋️'],
  ['entertainment', '🎬'],
  ['travel', '✈️'],
  ['vacation', '✈️'],
  ['clothing', '👕'],
  ['shopping', '🛍️'],
  ['education', '🎓'],
  ['tuition', '🎓'],
  ['gift', '🎁'],
  ['charity', '🤝'],
  ['donation', '🤝'],
  ['savings', '💰'],
  ['investment', '📈'],
  ['salary', '💵'],
  ['payroll', '💵'],
  ['tax', '🧾'],
];

const DEFAULT_EMOJI = '🏷️';

export function emojiForLabel(label: string): string {
  const lower = label.toLowerCase();
  const match = KEYWORD_EMOJI.find(([keyword]) => lower.includes(keyword));
  return match ? match[1] : DEFAULT_EMOJI;
}

// Outflow "source" already distinguishes recurring/debt/bill/investment —
// falls back to this coarser mapping when a label has no keyword match,
// so every outflow still gets some icon rather than always defaulting to
// the generic tag.
const SOURCE_EMOJI: Record<'recurring_transaction' | 'debt' | 'bill' | 'investment', string> = {
  recurring_transaction: '🔁',
  debt: '💳',
  bill: '🧾',
  investment: '📈',
};

export function emojiForOutflow(label: string, source: keyof typeof SOURCE_EMOJI): string {
  const lower = label.toLowerCase();
  const match = KEYWORD_EMOJI.find(([keyword]) => lower.includes(keyword));
  return match ? match[1] : SOURCE_EMOJI[source];
}
