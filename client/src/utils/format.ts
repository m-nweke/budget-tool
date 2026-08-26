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
