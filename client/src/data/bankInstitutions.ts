// Curated list for AccountForm's institution dropdown. Deliberately not
// real bank logos/marks — bundling another company's trademarked artwork
// carries legal risk we don't need for what's just a visual differentiator.
// Instead each entry gets a flat brand-ish color + a short letter-mark,
// rendered by BankLogo.vue. "Other" isn't listed here — picking it in the
// form reveals a free-text input instead of a preset.
export interface BankInstitution {
  name: string;
  color: string;
  mark: string;
}

export const BANK_INSTITUTIONS: BankInstitution[] = [
  { name: 'Chase', color: '#117aca', mark: 'C' },
  { name: 'Bank of America', color: '#e11d3c', mark: 'BA' },
  { name: 'Wells Fargo', color: '#d71e28', mark: 'WF' },
  { name: 'Citibank', color: '#003b70', mark: 'CI' },
  { name: 'Capital One', color: '#004977', mark: 'CO' },
  { name: 'US Bank', color: '#0c3767', mark: 'US' },
  { name: 'PNC Bank', color: '#f47920', mark: 'PNC' },
  { name: 'Truist', color: '#4b2e83', mark: 'TR' },
  { name: 'TD Bank', color: '#54b848', mark: 'TD' },
  { name: 'Commerce Bank', color: '#0033a0', mark: 'CB' },
  { name: 'SoFi', color: '#00a3e0', mark: 'SF' },
  { name: 'Ally Bank', color: '#7b2cbf', mark: 'AL' },
  { name: 'Discover', color: '#ff6000', mark: 'DI' },
  { name: 'American Express', color: '#016fd0', mark: 'AX' },
  { name: 'Charles Schwab', color: '#00a0df', mark: 'CS' },
  { name: 'USAA', color: '#002554', mark: 'US' },
];

const FALLBACK_COLORS = ['#6b7280', '#8b5cf6', '#059669', '#d97706', '#0ea5e9', '#dc2626'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function markFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Case-insensitive lookup against the curated list, falling back to a
// deterministic color + initials for a custom/free-text institution name
// (e.g. a local credit union) so every account still gets a stable badge.
export function getInstitutionMeta(institution: string | null | undefined): BankInstitution | null {
  if (!institution || !institution.trim()) return null;
  const trimmed = institution.trim();
  const known = BANK_INSTITUTIONS.find((b) => b.name.toLowerCase() === trimmed.toLowerCase());
  if (known) return known;
  return {
    name: trimmed,
    color: FALLBACK_COLORS[hashString(trimmed) % FALLBACK_COLORS.length],
    mark: markFromName(trimmed),
  };
}
