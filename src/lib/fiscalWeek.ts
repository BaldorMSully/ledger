/**
 * Fiscal-week math for the weekly budget view (specs/002-weekly-fiscal-view). A fiscal
 * week runs Sunday-Saturday. Weeks are grouped into display-only 4-4-5 periods for
 * navigation/labeling; that grouping never feeds a budget calculation. A week's budget
 * target instead comes from `assignWeekToMonth` + `weeksAssignedToMonth`, which divide
 * the existing (unchanged) calendar-month `BucketAllocation` across whichever fiscal
 * weeks belong to that month.
 */
import { todayInputValue } from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * DAY_MS);
}

const DAY_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDayInput(value: string): Date {
  if (!DAY_INPUT_PATTERN.test(value)) {
    throw new Error(`Invalid day value: "${value}"`);
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

/** The Sunday on or before `date` (idempotent if `date` is already a Sunday). */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

/** The fiscal week (as its Sunday) containing "today" in the household's timezone. */
export function currentWeekStart(now: Date = new Date()): Date {
  return startOfWeek(parseDayInput(todayInputValue(now)));
}

export function addWeeks(weekStart: Date, delta: number): Date {
  return addDays(weekStart, delta * 7);
}

/** The Saturday that ends the fiscal week starting on `weekStart`. */
export function weekEndInclusive(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

export function weekInputValue(weekStart: Date): string {
  return dayInputValue(weekStart);
}

/** Parses a "YYYY-MM-DD" fiscal-week-start value; throws if it isn't a Sunday. */
export function parseWeekInput(value: string): Date {
  const day = parseDayInput(value);
  if (day.getUTCDay() !== 0) {
    throw new Error(`Week start must be a Sunday: "${value}"`);
  }
  return day;
}

/**
 * Safe variant for URL query params, which anyone can hand-edit: unparseable, absent,
 * or non-Sunday input falls back to the current week instead of throwing.
 */
export function parseWeekParam(value: string | undefined): Date {
  if (value) {
    try {
      return parseWeekInput(value);
    } catch {
      // fall through to current week
    }
  }
  return currentWeekStart();
}

/**
 * How far through the fiscal week "now" is, as a percentage (day-of-week granularity),
 * mirroring `monthProgressPercent` — Sunday is a small fraction, Saturday is 100%.
 */
export function weekProgressPercent(now: Date = new Date()): number {
  const today = parseDayInput(todayInputValue(now));
  const dayIndex = today.getUTCDay() + 1; // Sunday=1 .. Saturday=7
  return Math.round((dayIndex / 7) * 10000) / 100;
}

/**
 * Which calendar month a fiscal week "belongs to" for budget-target purposes: whichever
 * month contains 4 or more of the week's 7 days. A 7-day week can span at most two
 * calendar months (no month is shorter than 28 days), so this is always decisive - no
 * tie-break needed.
 */
export function assignWeekToMonth(weekStart: Date): { year: number; month: number } {
  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth();
    const key = `${year}-${month}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { year, month, count: 1 });
    }
  }
  let best: { year: number; month: number; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }
  return { year: best!.year, month: best!.month };
}

/**
 * How many fiscal weeks are assigned (via `assignWeekToMonth`) to the calendar month
 * `[monthStart, monthEndExclusive)` — used to divide that month's `BucketAllocation`
 * into a per-week target.
 */
export function weeksAssignedToMonth(monthStart: Date, monthEndExclusive: Date): number {
  let count = 0;
  let week = startOfWeek(addDays(monthStart, -6));
  while (week.getTime() < monthEndExclusive.getTime()) {
    const assigned = assignWeekToMonth(week);
    if (assigned.year === monthStart.getUTCFullYear() && assigned.month === monthStart.getUTCMonth()) {
      count += 1;
    }
    week = addWeeks(week, 1);
  }
  return count;
}

/**
 * The first fiscal week (a Sunday) of the given fiscal year — defined as the week that
 * `assignWeekToMonth` assigns to January of that year. Reuses the same majority rule so
 * fiscal-year boundaries and month-assignment boundaries never disagree.
 */
export function fiscalYearStart(year: number): Date {
  const week = startOfWeek(new Date(Date.UTC(year, 0, 1)));
  const assigned = assignWeekToMonth(week);
  return assigned.year === year && assigned.month === 0 ? week : addWeeks(week, 1);
}

const WEEKS_PER_PERIOD_IN_QUARTER = [4, 4, 5];
const MAX_FISCAL_WEEKS_PER_YEAR = 53;

/**
 * 0-based index of `weekStart` within its fiscal year, and which fiscal year it's in.
 * Display-only (FR-006) — never used for budget math.
 */
function fiscalYearAndWeekIndex(weekStart: Date): { fiscalYear: number; weekIndex: number } {
  const calendarYear = weekStart.getUTCFullYear();
  for (const candidateYear of [calendarYear, calendarYear + 1, calendarYear - 1]) {
    const start = fiscalYearStart(candidateYear);
    const weekIndex = Math.round((weekStart.getTime() - start.getTime()) / (7 * DAY_MS));
    if (weekIndex >= 0 && weekIndex < MAX_FISCAL_WEEKS_PER_YEAR) {
      return { fiscalYear: candidateYear, weekIndex };
    }
  }
  throw new Error(`Could not resolve a fiscal year for week starting ${dayInputValue(weekStart)}`);
}

/**
 * Display-only "Period N, Week M of L" label for a fiscal week, per the 4-4-5 pattern
 * (four weeks, four weeks, five weeks per 13-week quarter). Never affects budget math
 * (see module doc comment) — a rare 53-week fiscal year just rolls into a one-week
 * "Period 13" rather than needing any special handling.
 */
export function fiscalPeriodLabel(weekStart: Date): string {
  const { weekIndex } = fiscalYearAndWeekIndex(weekStart);
  let remaining = weekIndex;
  let period = 1;
  for (;;) {
    const periodLength = WEEKS_PER_PERIOD_IN_QUARTER[(period - 1) % 3];
    if (remaining < periodLength) {
      return `Period ${period}, Week ${remaining + 1} of ${periodLength}`;
    }
    remaining -= periodLength;
    period += 1;
  }
}
