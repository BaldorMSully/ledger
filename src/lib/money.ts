/**
 * All money in this app is stored as integer cents (signed). Never use floats for amounts —
 * floating point can't represent currency exactly and errors compound across a ledger.
 */

export function centsToDollarsString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function formatCents(
  cents: number,
  locale = "en-US",
  currency = "USD"
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100
  );
}

/** Parses a user-entered dollar string (e.g. "12.5", "-3.00", "12") into integer cents. */
export function dollarsToCents(input: string): number {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid dollar amount: "${input}"`);
  }
  const negative = trimmed.startsWith("-");
  const [dollarsPart, centsPart = ""] = trimmed.replace("-", "").split(".");
  const cents =
    parseInt(dollarsPart, 10) * 100 + parseInt(centsPart.padEnd(2, "0"), 10);
  return negative ? -cents : cents;
}

export function sumCents(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
