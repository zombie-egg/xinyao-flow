const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const MAX_DECIMAL_14_2_CENTS = 99_999_999_999_999;

export function moneyToCents(value: string): number {
  const normalized = value.trim();
  if (!MONEY_PATTERN.test(normalized)) throw new Error("INVALID_MONEY");

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_DECIMAL_14_2_CENTS)
    throw new Error("MONEY_OUT_OF_RANGE");
  return cents;
}

export function isMoney(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    moneyToCents(value);
    return true;
  } catch {
    return false;
  }
}

export function centsToMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("INVALID_CENTS");
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function normalizeMoney(value: string): string {
  return centsToMoney(moneyToCents(value));
}

export type OrderAmounts = {
  amount: string;
  technicalSupportFee: string;
  outsourcingFee: string;
  reviewFee: string;
  otherExpense: string;
};

function optionalMoneyToCents(value: string): number | null {
  if (value.trim() === "") return 0;
  try {
    return moneyToCents(value);
  } catch {
    return null;
  }
}

export function calculateNetAmountCents(values: OrderAmounts): number | null {
  const cents = [
    values.amount,
    values.technicalSupportFee,
    values.outsourcingFee,
    values.reviewFee,
    values.otherExpense,
  ].map(optionalMoneyToCents);
  if (cents.some((value) => value === null)) return null;
  return cents[0]! - cents[1]! - cents[2]! - cents[3]! - cents[4]!;
}

export function calculateNetAmount(values: OrderAmounts): string {
  const cents = calculateNetAmountCents(values);
  if (cents === null) throw new Error("INVALID_MONEY");
  return centsToMoney(cents);
}
