import { HttpError } from "./httpError.js";

const THALI_PRICES: Record<number, number> = {
  1: 110,
  2: 110,
  3: 90,
  4: 90,
  5: 75,
};

const EXTRA_UNIT_PRICES: Record<string, number> = {
  roti: 10,
  sabji: 40,
  dalRice: 40,
  rice: 30,
};

export type ExtraItemsInput = Record<string, unknown>;

export function calculateTotal({
  thaliIds = [],
  extraItems = {},
}: {
  thaliIds?: number[];
  extraItems?: ExtraItemsInput;
}): { total: number } {
  let thaliPortion = 0;
  if (!Array.isArray(thaliIds)) {
    const err = new Error("thaliIds must be an array") as Error & {
      code: string;
    };
    err.code = "INVALID_THALI";
    throw err;
  }
  for (const raw of thaliIds) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1 || id > 5) {
      const err = new Error(
        "each thaliIds entry must be an integer from 1 to 5"
      ) as Error & { code: string };
      err.code = "INVALID_THALI";
      throw err;
    }
    thaliPortion += THALI_PRICES[id] ?? 0;
  }

  const keys = ["roti", "sabji", "dalRice", "rice"] as const;
  let extrasPortion = 0;
  for (const key of keys) {
    const raw = extraItems[key];
    const n = raw === undefined || raw === null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      const err = new Error(
        `extraItems.${key} must be a non-negative integer`
      ) as Error & { code: string };
      err.code = "INVALID_EXTRA";
      throw err;
    }
    extrasPortion += n * (EXTRA_UNIT_PRICES[key] ?? 0);
  }

  return { total: thaliPortion + extrasPortion };
}

export { THALI_PRICES, EXTRA_UNIT_PRICES };

function isPricingError(
  e: unknown
): e is Error & { code: "INVALID_THALI" | "INVALID_EXTRA" } {
  return (
    e instanceof Error &&
    "code" in e &&
    (e.code === "INVALID_THALI" || e.code === "INVALID_EXTRA")
  );
}

export function mapPricingErrorToHttp(e: unknown): HttpError | null {
  if (isPricingError(e)) {
    return new HttpError(400, e.message);
  }
  return null;
}
