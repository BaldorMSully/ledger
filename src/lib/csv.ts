import { parse } from "csv-parse/sync";
import { dollarsToCents } from "./money";

/**
 * Parses the household's bank export format: quoted CSV with a `Date, Status, Type,
 * CheckNumber, Description, Withdrawal, Deposit, RunningBalance` header, MM/DD/YYYY dates,
 * and the transaction amount split across separate Withdrawal/Deposit columns rather than
 * one signed field. Built against a real sample export (see specs/001-budget-checkin/) —
 * if the household ever changes banks, this will need revisiting (plan.md §7).
 */

export type CsvRowStatus = "new" | "duplicate" | "unparseable";

export interface ParsedCsvRow {
  rawLine: Record<string, string>;
  status: CsvRowStatus;
  parsedDate: Date | null;
  parsedAmountCents: number | null;
  parsedDescription: string | null;
  errorMessage: string | null;
}

/** The subset of an existing Transaction needed to check FR-010's exact-match dedup rule. */
export interface ExistingTransactionKey {
  transactionDate: Date;
  amountCents: number;
  description: string | null;
}

const BANK_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseBankDate(value: string): Date | null {
  const match = BANK_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject e.g. "02/30/2026" — Date.UTC silently rolls it into March.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Exact match on date + amount + description — FR-010's dedup rule, deliberately simple. */
function dedupeKey(date: Date, amountCents: number, description: string | null): string {
  return `${date.toISOString().slice(0, 10)}|${amountCents}|${description ?? ""}`;
}

/**
 * Parses and classifies every row of an uploaded CSV. `Pending` rows are filtered out
 * before classification entirely (plan.md §7 — some have no amount yet, and their
 * description can change once they post). Every classified row keeps its raw parsed
 * data even when `unparseable`, so the preview can show individual per-row errors
 * (FR-009) instead of failing the whole import.
 */
export interface ClassifiedCsv {
  rows: ParsedCsvRow[];
  /** Rows filtered out before classification because Status was "Pending" (plan.md §7). */
  pendingSkippedCount: number;
}

export function parseAndClassifyCsv(
  csvText: string,
  existing: ExistingTransactionKey[]
): ClassifiedCsv {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const existingKeys = new Set(
    existing.map((tx) => dedupeKey(tx.transactionDate, tx.amountCents, tx.description))
  );

  const rows: ParsedCsvRow[] = [];
  let pendingSkippedCount = 0;

  for (const record of records) {
    const rawStatus = String(record.Status ?? "").trim();
    if (rawStatus.toLowerCase() === "pending") {
      pendingSkippedCount += 1;
      continue;
    }

    const description = String(record.Description ?? "").trim() || null;
    const parsedDate = parseBankDate(String(record.Date ?? ""));
    const withdrawal = String(record.Withdrawal ?? "").trim();
    const deposit = String(record.Deposit ?? "").trim();

    let parsedAmountCents: number | null = null;
    let errorMessage: string | null = null;

    if (!parsedDate) {
      errorMessage = `Unparseable date: "${record.Date ?? ""}"`;
    } else if (withdrawal && deposit) {
      errorMessage = "Row has both a withdrawal and a deposit amount";
    } else if (withdrawal) {
      try {
        parsedAmountCents = -Math.abs(dollarsToCents(withdrawal));
      } catch {
        errorMessage = `Unparseable withdrawal amount: "${withdrawal}"`;
      }
    } else if (deposit) {
      try {
        parsedAmountCents = Math.abs(dollarsToCents(deposit));
      } catch {
        errorMessage = `Unparseable deposit amount: "${deposit}"`;
      }
    } else {
      errorMessage = "Row has no withdrawal or deposit amount";
    }

    if (errorMessage || !parsedDate || parsedAmountCents === null) {
      rows.push({
        rawLine: record,
        status: "unparseable",
        parsedDate,
        parsedAmountCents,
        parsedDescription: description,
        errorMessage,
      });
      continue;
    }

    const isDuplicate = existingKeys.has(dedupeKey(parsedDate, parsedAmountCents, description));
    rows.push({
      rawLine: record,
      status: isDuplicate ? "duplicate" : "new",
      parsedDate,
      parsedAmountCents,
      parsedDescription: description,
      errorMessage: null,
    });
  }

  return { rows, pendingSkippedCount };
}
