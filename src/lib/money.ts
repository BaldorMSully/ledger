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

// The amount columns are 4-byte Postgres Ints (max ~$21.4M in cents); cap well below
// that so oversized input is a validation error, not a database error.
export const MAX_AMOUNT_CENTS = 1_000_000_000; // $10M

/** Parses a user-entered dollar string (e.g. "12.5", "-3.00", "$1,200", ".50") into integer cents. */
export function dollarsToCents(input: string): number {
  // People type money the way money looks — strip $, thousands separators, and spaces.
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!/^-?(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(trimmed)) {
    throw new Error(`Invalid dollar amount: "${input}"`);
  }
  const negative = trimmed.startsWith("-");
  const [dollarsPart, centsPart = ""] = trimmed.replace("-", "").split(".");
  const cents =
    parseInt(dollarsPart || "0", 10) * 100 + parseInt(centsPart.padEnd(2, "0"), 10);
  if (cents > MAX_AMOUNT_CENTS) {
    throw new Error(`Amount out of range: "${input}"`);
  }
  return negative ? -cents : cents;
}

export function sumCents(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
