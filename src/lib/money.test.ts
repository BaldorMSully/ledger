import { describe, it, expect } from "vitest";
import { centsToDollarsString, dollarsToCents, formatCents, sumCents } from "./money";

describe("dollarsToCents", () => {
  it("parses whole dollars", () => {
    expect(dollarsToCents("12")).toBe(1200);
  });
  it("parses cents", () => {
    expect(dollarsToCents("12.5")).toBe(1250);
    expect(dollarsToCents("12.05")).toBe(1205);
  });
  it("parses negative amounts", () => {
    expect(dollarsToCents("-3.00")).toBe(-300);
  });
  it("strips currency symbols, commas, and spaces", () => {
    expect(dollarsToCents("$12.50")).toBe(1250);
    expect(dollarsToCents("1,200")).toBe(120000);
    expect(dollarsToCents("-$3.00")).toBe(-300);
    expect(dollarsToCents(" $1,234.56 ")).toBe(123456);
  });
  it("accepts bare-cents input", () => {
    expect(dollarsToCents(".50")).toBe(50);
    expect(dollarsToCents("-.5")).toBe(-50);
  });
  it("rejects garbage input", () => {
    expect(() => dollarsToCents("abc")).toThrow();
    expect(() => dollarsToCents("12.999")).toThrow();
    expect(() => dollarsToCents("$")).toThrow();
    expect(() => dollarsToCents("")).toThrow();
  });
  it("rejects amounts that would overflow the Int column", () => {
    expect(() => dollarsToCents("99999999999")).toThrow();
  });
});

describe("centsToDollarsString", () => {
  it("round-trips with dollarsToCents", () => {
    expect(centsToDollarsString(1205)).toBe("12.05");
    expect(centsToDollarsString(-300)).toBe("-3.00");
    expect(centsToDollarsString(0)).toBe("0.00");
  });
});

describe("formatCents", () => {
  it("formats as USD currency", () => {
    expect(formatCents(1250)).toBe("$12.50");
  });
});

describe("sumCents", () => {
  it("sums a list of signed cent amounts", () => {
    expect(sumCents([100, -50, 25])).toBe(75);
    expect(sumCents([])).toBe(0);
  });
});
