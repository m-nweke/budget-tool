const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

// For rendering a single-word lowercase enum value (account type, paycheck
// frequency, etc.) as a display label — just the first letter, since these
// are all plain single words with no internal casing to worry about.
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// A tenant can have two accounts with the same name but different types
// (a "Chase" checking and a "Chase" savings) — anywhere an account shows up
// outside AccountsView's own list (which already renders a type badge next
// to the name), a bare account.name is ambiguous between the two. Every
// picker/label that isn't that list should use this instead.
export function accountLabel(account: { name: string; type: string }): string {
  return `${account.name} (${capitalize(account.type)})`;
}
