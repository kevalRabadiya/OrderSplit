const THALI_PRICES = {
  1: 110,
  2: 110,
  3: 90,
  4: 90,
  5: 75,
};

const EXTRA_UNIT_PRICES = {
  roti: 10,
  sabji: 40,
  dalRice: 40,
  rice: 30,
};

/**
 * @param {{ thaliId: number | null, extraItems?: Record<string, number> }} input
 * @returns {{ total: number }}
 * @throws {{ code: string, message: string }}
 */
export function calculateTotal({ thaliId, extraItems = {} }) {
  let thaliPortion = 0;
  if (thaliId != null && thaliId !== "") {
    const id = Number(thaliId);
    if (!Number.isInteger(id) || id < 1 || id > 5) {
      const err = new Error("thaliId must be null or an integer 1–5");
      err.code = "INVALID_THALI";
      throw err;
    }
    thaliPortion = THALI_PRICES[id];
  }

  const keys = ["roti", "sabji", "dalRice", "rice"];
  let extrasPortion = 0;
  for (const key of keys) {
    const raw = extraItems[key];
    const n = raw === undefined || raw === null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      const err = new Error(`extraItems.${key} must be a non-negative integer`);
      err.code = "INVALID_EXTRA";
      throw err;
    }
    extrasPortion += n * EXTRA_UNIT_PRICES[key];
  }

  return { total: thaliPortion + extrasPortion };
}

export { THALI_PRICES, EXTRA_UNIT_PRICES };
