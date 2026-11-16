const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const number = new Intl.NumberFormat('en-US');
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatMoney = (amount: number) => money.format(amount);
export const formatNumber = (value: number) => number.format(value);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** `TRANSFER_OUT` -> `Transfer out`. */
export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
