// Curated list for AccountForm's institution dropdown. Each curated entry
// carries the bank's official domain, which BankLogo.vue resolves to the
// bank's real logo via Google's public favicon service (`google.com/s2/
// favicons?domain=<domain>`) — a live-fetched image, not a bundled asset,
// so this repo never stores or redistributes another company's
// trademarked artwork itself. (Clearbit's logo.clearbit.com, the more
// common choice for this, has been discontinued — its domain no longer
// resolves at all — so this uses Google's favicon endpoint instead.)
// `color`/`mark` remain as the fallback badge for a custom/unlisted
// institution (via "Other"), and for the rare case the logo image fails
// to load. "Other" isn't listed here — picking it in the form reveals a
// free-text input instead of a preset.
// Shared sentinel for "the custom/free-text option was picked" — used by
// both AccountForm.vue (which shows the free-text input when this is
// selected) and InstitutionPicker.vue (the dropdown that lets you pick
// it), so the two stay in sync without hardcoding the string twice.
export const OTHER_INSTITUTION = '__other__';

export interface BankInstitution {
  name: string;
  color: string;
  mark: string;
  domain?: string;
}

export const BANK_INSTITUTIONS: BankInstitution[] = [
  { name: 'Chase', color: '#117aca', mark: 'C', domain: 'chase.com' },
  { name: 'Bank of America', color: '#e11d3c', mark: 'BA', domain: 'bankofamerica.com' },
  { name: 'Wells Fargo', color: '#d71e28', mark: 'WF', domain: 'wellsfargo.com' },
  { name: 'Citibank', color: '#003b70', mark: 'CI', domain: 'citibank.com' },
  { name: 'Capital One', color: '#004977', mark: 'CO', domain: 'capitalone.com' },
  { name: 'US Bank', color: '#0c3767', mark: 'US', domain: 'usbank.com' },
  { name: 'PNC Bank', color: '#f47920', mark: 'PNC', domain: 'pnc.com' },
  { name: 'Truist', color: '#4b2e83', mark: 'TR', domain: 'truist.com' },
  { name: 'TD Bank', color: '#54b848', mark: 'TD', domain: 'td.com' },
  { name: 'Commerce Bank', color: '#0033a0', mark: 'CB', domain: 'commercebank.com' },
  { name: 'SoFi', color: '#00a3e0', mark: 'SF', domain: 'sofi.com' },
  { name: 'Ally Bank', color: '#7b2cbf', mark: 'AL', domain: 'ally.com' },
  { name: 'Discover', color: '#ff6000', mark: 'DI', domain: 'discover.com' },
  { name: 'American Express', color: '#016fd0', mark: 'AX', domain: 'americanexpress.com' },
  { name: 'Charles Schwab', color: '#00a0df', mark: 'CS', domain: 'schwab.com' },
  { name: 'USAA', color: '#002554', mark: 'US', domain: 'usaa.com' },
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

export function logoUrl(institution: BankInstitution): string | null {
  return institution.domain
    ? `https://www.google.com/s2/favicons?domain=${institution.domain}&sz=64`
    : null;
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
