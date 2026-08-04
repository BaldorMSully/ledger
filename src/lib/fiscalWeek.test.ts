import { describe, it, expect } from "vitest";
import { parseMonthInput, addMonths } from "./dates";
import {
  currentWeekStart,
  startOfWeek,
  addWeeks,
  weekEndInclusive,
  weekInputValue,
  parseWeekInput,
  parseWeekParam,
  weekProgressPercent,
  assignWeekToMonth,
  weeksAssignedToMonth,
  fiscalYearStart,
  fiscalPeriodLabel,
} from "./fiscalWeek";

// Real-calendar anchor used throughout: August 1, 2026 is a Saturday, so the fiscal
// week containing it runs Sunday July 26 - Saturday Aug 1, and the next fiscal week
// (containing the 2026-08-02 household check-in) runs Sunday Aug 2 - Saturday Aug 8.

describe("startOfWeek / currentWeekStart", () => {
  it("finds the Sunday on or before a Saturday", () => {
    expect(weekInputValue(startOfWeek(new Date("2026-08-01T00:00:00Z")))).toBe(
      "2026-07-26"
    );
  });

  it("is idempotent on a Sunday itself", () => {
    expect(weekInputValue(startOfWeek(new Date("2026-08-02T00:00:00Z")))).toBe(
      "2026-08-02"
    );
  });

  it("uses the household timezone, not UTC", () => {
    // 2026-08-02T01:30 UTC is still Saturday Aug 1 evening in New York.
    expect(
      weekInputValue(currentWeekStart(new Date("2026-08-02T01:30:00Z")))
    ).toBe("2026-07-26");
  });
});

describe("addWeeks / weekEndInclusive", () => {
  it("moves forward and back in 7-day steps", () => {
    const week = parseWeekInput("2026-07-26");
    expect(weekInputValue(addWeeks(week, 1))).toBe("2026-08-02");
    expect(weekInputValue(addWeeks(week, -1))).toBe("2026-07-19");
  });

  it("ends 6 days after the start (Saturday)", () => {
    const week = parseWeekInput("2026-08-02");
    expect(weekInputValue(weekEndInclusive(week))).toBe("2026-08-08");
  });
});

describe("parseWeekInput / parseWeekParam", () => {
  it("rejects a day that isn't a Sunday", () => {
    expect(() => parseWeekInput("2026-08-01")).toThrow();
  });

  it("falls back to the current week on garbage or absence", () => {
    const fallback = weekInputValue(currentWeekStart());
    expect(weekInputValue(parseWeekParam("garbage"))).toBe(fallback);
    expect(weekInputValue(parseWeekParam(undefined))).toBe(fallback);
  });
});

describe("weekProgressPercent", () => {
  it("is a small fraction on Sunday, the first day", () => {
    expect(weekProgressPercent(new Date("2026-07-26T15:00:00Z"))).toBeCloseTo(
      (1 / 7) * 100,
      1
    );
  });

  it("is 100% on Saturday, the last day", () => {
    expect(weekProgressPercent(new Date("2026-08-01T15:00:00Z"))).toBe(100);
  });

  it("uses the household timezone at the UTC day boundary", () => {
    // Still Saturday evening in New York.
    expect(weekProgressPercent(new Date("2026-08-02T01:30:00Z"))).toBe(100);
  });
});

describe("assignWeekToMonth", () => {
  it("assigns a 6-day-July/1-day-August week to July", () => {
    expect(assignWeekToMonth(parseWeekInput("2026-07-26"))).toEqual({
      year: 2026,
      month: 6, // July, 0-based
    });
  });

  it("assigns a 3-day-March/4-day-April week to April (the 4-day side wins)", () => {
    // April 1, 2026 is a Wednesday, so this week is Mar 29 - Apr 4: 3 days March, 4 April.
    expect(assignWeekToMonth(parseWeekInput("2026-03-29"))).toEqual({
      year: 2026,
      month: 3, // April, 0-based
    });
  });

  it("assigns a week fully inside one month to that month", () => {
    expect(assignWeekToMonth(parseWeekInput("2026-08-02"))).toEqual({
      year: 2026,
      month: 7, // August, 0-based
    });
  });
});

describe("weeksAssignedToMonth", () => {
  it("counts July 2026 as having 5 fiscal weeks", () => {
    // July weeks: Jun28-Jul4 (4 days July, majority - included), Jul5-11, Jul12-18,
    // Jul19-25 (fully July), Jul26-Aug1 (6 days July, majority - included) = 5 weeks.
    const july = parseMonthInput("2026-07");
    expect(weeksAssignedToMonth(july, addMonths(july, 1))).toBe(5);
  });

  it("counts April 2026 as having 5 fiscal weeks", () => {
    // Mar29-Apr4 is assigned to April (see above), plus 4 full weeks, plus the week
    // starting Apr26 (mostly April) = 5.
    const april = parseMonthInput("2026-04");
    expect(weeksAssignedToMonth(april, addMonths(april, 1))).toBe(5);
  });
});

describe("fiscalYearStart", () => {
  it("starts on a Sunday assigned to January of that year", () => {
    const start = fiscalYearStart(2026);
    expect(start.getUTCDay()).toBe(0);
    expect(assignWeekToMonth(start)).toEqual({ year: 2026, month: 0 });
  });

  it("the week before it is assigned to December of the prior year", () => {
    const start = fiscalYearStart(2026);
    const priorWeek = addWeeks(start, -1);
    const assigned = assignWeekToMonth(priorWeek);
    expect(assigned.year === 2025 && assigned.month === 11).toBe(true);
  });
});

describe("fiscalPeriodLabel", () => {
  it("labels the fiscal year's first week as Period 1, Week 1 of 4", () => {
    const start = fiscalYearStart(2026);
    expect(fiscalPeriodLabel(start)).toBe("Period 1, Week 1 of 4");
  });

  it("labels the 5th week as the start of Period 2 (a 4-week period)", () => {
    const start = fiscalYearStart(2026);
    expect(fiscalPeriodLabel(addWeeks(start, 4))).toBe("Period 2, Week 1 of 4");
  });

  it("labels the 9th week as the start of Period 3 (a 5-week period)", () => {
    const start = fiscalYearStart(2026);
    expect(fiscalPeriodLabel(addWeeks(start, 8))).toBe("Period 3, Week 1 of 5");
  });

  it("labels the 13th week as the last week of Period 3, closing the first quarter", () => {
    const start = fiscalYearStart(2026);
    expect(fiscalPeriodLabel(addWeeks(start, 12))).toBe("Period 3, Week 5 of 5");
  });

  it("labels the 14th week as the start of Period 4, opening the second quarter", () => {
    const start = fiscalYearStart(2026);
    expect(fiscalPeriodLabel(addWeeks(start, 13))).toBe("Period 4, Week 1 of 4");
  });
});
