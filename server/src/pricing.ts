import { HttpError } from "./httpError.js";

const THALI_PRICES: Record<number, number> = {
  1: 110,
  2: 110,
  3: 90,
  4: 90,
  5: 75,
};

/** Allowed values for dal-rice dropdown (₹40 when set). */
export const DAL_RICE_TYPES = ["Pulav", "Khichdi", "Dalrice"] as const;

const ROTI_PRICE = 10;
const RICE_PRICE = 30;
const SABJI_UNIT_PRICE = 40;
const DAL_RICE_UNIT_PRICE = 40;
const SABJI_MAX_LEN = 80;

export type ExtraItemsInput = Record<string, unknown>;

export type ParsedExtraItems = {
  roti: number;
  rice: number;
  sabji1: string;
  sabji2: string;
  dalRiceType: string;
};

function parseNonNegInt(raw: unknown, key: string): number {
  const n = raw === undefined || raw === null ? 0 : Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    const err = new Error(
      `extraItems.${key} must be a non-negative integer`
    ) as Error & { code: string };
    err.code = "INVALID_EXTRA";
    throw err;
  }
  return n;
}

function normalizeSabjiString(raw: unknown, key: "sabji1" | "sabji2"): string {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  if (s.length > SABJI_MAX_LEN) {
    const err = new Error(
      `extraItems.${key} must be at most ${SABJI_MAX_LEN} characters`
    ) as Error & { code: string };
    err.code = "INVALID_EXTRA";
    throw err;
  }
  return s;
}

/** Empty string or one of DAL_RICE_TYPES. */
export function normalizeDalRiceType(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const s = String(raw).trim();
  if (s === "") return "";
  if ((DAL_RICE_TYPES as readonly string[]).includes(s)) return s;
  const err = new Error(
    `extraItems.dalRiceType must be one of: ${DAL_RICE_TYPES.join(", ")}`
  ) as Error & { code: string };
  err.code = "INVALID_EXTRA";
  throw err;
}

export function parseAndValidateExtraItems(
  extraItems: ExtraItemsInput
): ParsedExtraItems {
  return {
    roti: parseNonNegInt(extraItems.roti, "roti"),
    rice: parseNonNegInt(extraItems.rice, "rice"),
    sabji1: normalizeSabjiString(extraItems.sabji1, "sabji1"),
    sabji2: normalizeSabjiString(extraItems.sabji2, "sabji2"),
    dalRiceType: normalizeDalRiceType(extraItems.dalRiceType),
  };
}

export function calculateTotal({
  thaliIds = [],
  extraItems = {},
}: {
  thaliIds?: number[];
  extraItems?: ExtraItemsInput;
}): { total: number; parsedExtras: ParsedExtraItems } {
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

  const p = parseAndValidateExtraItems(extraItems);
  const sabjiCount = (p.sabji1 ? 1 : 0) + (p.sabji2 ? 1 : 0);
  const dalRiceCount = p.dalRiceType ? 1 : 0;
  const extrasPortion =
    p.roti * ROTI_PRICE +
    p.rice * RICE_PRICE +
    sabjiCount * SABJI_UNIT_PRICE +
    dalRiceCount * DAL_RICE_UNIT_PRICE;

  return {
    total: thaliPortion + extrasPortion,
    parsedExtras: p,
  };
}

export { THALI_PRICES };

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
