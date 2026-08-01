/**
 * The household lives in America/New_York but the server runs in UTC. "Today" and
 * "this month" must be computed in the household's timezone — otherwise evening
 * entries (after 8pm EDT) default to tomorrow's date, and on the last evening of a
 * month the dashboard opens on next month's budget.
 */
const HOUSEHOLD_TIME_ZONE = "America/New_York";

export function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date as a "YYYY-MM-DD" string in the household's timezone. */
export function todayInputValue(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOUSEHOLD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** First of the current month in the household's timezone, as a first-of-month UTC Date. */
export function currentMonthStart(now: Date = new Date()): Date {
  return parseMonthInput(todayInputValue(now).slice(0, 7));
}

const MONTH_INPUT_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Parses a "YYYY-MM" string (from an <input type="month">) into a first-of-month UTC Date. */
export function parseMonthInput(value: string): Date {
  if (!MONTH_INPUT_PATTERN.test(value)) {
    throw new Error(`Invalid month value: "${value}"`);
  }
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Safe variant for URL query params, which anyone can hand-edit: unparseable or absent
 * input falls back to the current month instead of throwing (and 500ing the page).
 */
export function parseMonthParam(value: string | undefined): Date {
  return value && MONTH_INPUT_PATTERN.test(value)
    ? parseMonthInput(value)
    : currentMonthStart();
}

export function monthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Number of days in the month starting at `monthStart` (a first-of-month UTC Date). */
function daysInMonth(monthStart: Date): number {
  const nextMonthStart = addMonths(monthStart, 1);
  return Math.round((nextMonthStart.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * How far through the household's current calendar month "now" is, as a percentage
 * (day-of-month granularity, not intraday) — used to compare against % of budget used.
 * Always divides by the real number of days in the current month, so this doesn't
 * misfire in February or at a month boundary the way a hardcoded "/30" would.
 */
export function monthProgressPercent(now: Date = new Date()): number {
  const [year, month, day] = todayInputValue(now).split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const totalDays = daysInMonth(monthStart);
  return Math.round((day / totalDays) * 10000) / 100;
}
