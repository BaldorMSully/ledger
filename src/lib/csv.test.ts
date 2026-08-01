import { describe, it, expect } from "vitest";
import { parseAndClassifyCsv } from "./csv";

// Shaped like a real row from the household's bank export (headers/quoting/format match
// the actual sample in specs/001-budget-checkin/).
const HEADER =
  '"Date","Status","Type","CheckNumber","Description","Withdrawal","Deposit","RunningBalance"';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseAndClassifyCsv", () => {
  it("parses a quoted field with an embedded comma", () => {
    const { rows } = parseAndClassifyCsv(
      csv(
        '"08/01/2026","Posted","VISA","","OMNY VENDING* NEW YORK, NY, US","$36.00","",""'
      ),
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].parsedDescription).toBe("OMNY VENDING* NEW YORK, NY, US");
    expect(rows[0].parsedAmountCents).toBe(-3600);
    expect(rows[0].status).toBe("new");
  });

  it("filters out Pending rows entirely rather than surfacing them, and counts them", () => {
    const { rows, pendingSkippedCount } = parseAndClassifyCsv(
      csv(
        '"08/01/2026","Pending","","","DOORDASH.COM","","",""',
        '"08/01/2026","Posted","VISA","","DD *DOORDASH BAGELOASI","$69.30","","$1,812.16"'
      ),
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].parsedDescription).toBe("DD *DOORDASH BAGELOASI");
    expect(pendingSkippedCount).toBe(1);
  });

  it("parses a deposit as a positive amount", () => {
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","DEPOSIT","","Deposit Mobile Banking","","$300.00","$5,940.35"'),
      []
    );
    expect(rows[0].parsedAmountCents).toBe(30000);
  });

  it("flags a row with no withdrawal or deposit as unparseable, not a crash", () => {
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","ACH","","MYSTERY ROW","","",""'),
      []
    );
    expect(rows[0].status).toBe("unparseable");
    expect(rows[0].errorMessage).toBeTruthy();
  });

  it("flags an unparseable date individually without failing the whole import", () => {
    const { rows } = parseAndClassifyCsv(
      csv(
        '"not-a-date","Posted","VISA","","BAD ROW","$10.00","",""',
        '"08/01/2026","Posted","VISA","","GOOD ROW","$10.00","",""'
      ),
      []
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("unparseable");
    expect(rows[1].status).toBe("new");
  });

  it("flags an exact date+amount+description match against existing transactions as duplicate", () => {
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","DEPOSIT","","Deposit Mobile Banking","","$300.00","$5,940.35"'),
      [
        {
          transactionDate: new Date("2026-07-31T00:00:00Z"),
          amountCents: 30000,
          description: "Deposit Mobile Banking",
        },
      ]
    );
    expect(rows[0].status).toBe("duplicate");
  });

  it("flags a real, distinct same-day/same-amount/same-description transaction as duplicate too (exact-match rule, no smart heuristic) - the manual override in the UI is how it gets imported anyway", () => {
    // The real sample export has two genuinely separate $300 mobile deposits on the same day
    // with identical descriptions. The dedup rule is intentionally simple (exact match only);
    // resolving a false positive is a manual per-row decision in the preview UI, not something
    // this classifier tries to guess.
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","DEPOSIT","","Deposit Mobile Banking","","$300.00","$5,940.35"'),
      [
        {
          transactionDate: new Date("2026-07-31T00:00:00Z"),
          amountCents: 30000,
          description: "Deposit Mobile Banking",
        },
      ]
    );
    expect(rows[0].status).toBe("duplicate");
  });

  it("does not flag a transaction as duplicate when only some fields match", () => {
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","VISA","","CVS/PHARMACY #05830 FOREST HILLS","$26.98","",""'),
      [
        {
          transactionDate: new Date("2026-07-31T00:00:00Z"),
          amountCents: -2698,
          description: "A different merchant entirely",
        },
      ]
    );
    expect(rows[0].status).toBe("new");
  });

  it("completes with all rows classified as duplicate when every row already exists, rather than erroring", () => {
    const { rows } = parseAndClassifyCsv(
      csv('"07/31/2026","Posted","VISA","","CVS/PHARMACY #05830 FOREST HILLS","$26.98","",""'),
      [
        {
          transactionDate: new Date("2026-07-31T00:00:00Z"),
          amountCents: -2698,
          description: "CVS/PHARMACY #05830 FOREST HILLS",
        },
      ]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("duplicate");
  });
});
