import { describe, it, expect } from "vitest";
import {
  addMonths,
  currentMonthStart,
  monthInputValue,
  monthProgressPercent,
  parseMonthInput,
  parseMonthParam,
  todayInputValue,
} from "./dates";

describe("todayInputValue", () => {
  it("uses the household timezone, not UTC", () => {
    // 2026-08-01 01:30 UTC is still the evening of July 31 in New York.
    expect(todayInputValue(new Date("2026-08-01T01:30:00Z"))).toBe("2026-07-31");
  });
  it("matches UTC during the daytime", () => {
    expect(todayInputValue(new Date("2026-07-16T15:00:00Z"))).toBe("2026-07-16");
  });
  it("handles winter (EST) offsets too", () => {
    expect(todayInputValue(new Date("2026-01-01T04:30:00Z"))).toBe("2025-12-31");
  });
});

describe("currentMonthStart", () => {
  it("stays in the household's month across the UTC month boundary", () => {
    expect(
      monthInputValue(currentMonthStart(new Date("2026-08-01T01:30:00Z")))
    ).toBe("2026-07");
  });
});

describe("parseMonthInput", () => {
  it("round-trips with monthInputValue", () => {
    expect(monthInputValue(parseMonthInput("2026-07"))).toBe("2026-07");
  });
  it("rejects garbage and out-of-range months", () => {
    expect(() => parseMonthInput("garbage")).toThrow();
    expect(() => parseMonthInput("2026-13")).toThrow();
    expect(() => parseMonthInput("2026-00")).toThrow();
  });
});

describe("parseMonthParam", () => {
  it("parses valid input", () => {
    expect(monthInputValue(parseMonthParam("2026-02"))).toBe("2026-02");
  });
  it("falls back to the current month on garbage or absence", () => {
    const fallback = monthInputValue(currentMonthStart());
    expect(monthInputValue(parseMonthParam("garbage"))).toBe(fallback);
    expect(monthInputValue(parseMonthParam(undefined))).toBe(fallback);
  });
});

describe("addMonths", () => {
  it("crosses year boundaries in both directions", () => {
    expect(monthInputValue(addMonths(parseMonthInput("2026-01"), -1))).toBe("2025-12");
    expect(monthInputValue(addMonths(parseMonthInput("2026-12"), 1))).toBe("2027-01");
  });
});

describe("monthProgressPercent", () => {
  it("is a small fraction on the first day of a 31-day month", () => {
    // Aug 1, 2026, mid-morning New York time.
    expect(monthProgressPercent(new Date("2026-08-01T15:00:00Z"))).toBeCloseTo(
      (1 / 31) * 100,
      1
    );
  });

  it("is 100% on the last day of a 31-day month", () => {
    expect(monthProgressPercent(new Date("2026-08-31T15:00:00Z"))).toBe(100);
  });

  it("divides by 28 in a non-leap February", () => {
    // 2026 is not a leap year.
    expect(monthProgressPercent(new Date("2026-02-14T15:00:00Z"))).toBeCloseTo(
      (14 / 28) * 100,
      1
    );
    expect(monthProgressPercent(new Date("2026-02-28T15:00:00Z"))).toBe(100);
  });

  it("divides by 29 in a leap February", () => {
    // 2028 is a leap year.
    expect(monthProgressPercent(new Date("2028-02-29T15:00:00Z"))).toBe(100);
    expect(monthProgressPercent(new Date("2028-02-15T15:00:00Z"))).toBeCloseTo(
      (15 / 29) * 100,
      1
    );
  });

  it("uses the household timezone at the UTC month boundary", () => {
    // 2026-08-01 01:30 UTC is still July 31 evening in New York — should read
    // as the last day of July (100%), not the first day of August.
    expect(monthProgressPercent(new Date("2026-08-01T01:30:00Z"))).toBe(100);
  });
});
