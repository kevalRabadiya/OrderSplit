import { THALI_BUNDLES } from "../data/thaliBundles.js";

function readVitePrice(key, fallback) {
  const raw = import.meta.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const ROTI_PRICE = readVitePrice("VITE_ROTI_PRICE", 10);
const SABJI_PRICE = readVitePrice("VITE_SABJI_UNIT_PRICE", 40);
const DAL_PRICE = readVitePrice("VITE_DAL_RICE_UNIT_PRICE", 40);
const RICE_PRICE = readVitePrice("VITE_RICE_PRICE", 30);

export const EXTRA_PRICES = {
  roti: ROTI_PRICE,
  sabji: SABJI_PRICE,
  dalRice: DAL_PRICE,
  rice: RICE_PRICE,
};

const THALI_BY_ID = new Map(THALI_BUNDLES.map((b) => [b.id, b]));

function key(cr, cs, cd) {
  return `${cr},${cs},${cd}`;
}

/** @param {number[]} arr */
function heapPush(arr, item) {
  arr.push(item);
  let i = arr.length - 1;
  const [pc] = item;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (arr[p][0] <= pc) break;
    [arr[i], arr[p]] = [arr[p], arr[i]];
    i = p;
  }
}

/** @param {number[][]} arr */
function heapPop(arr) {
  if (arr.length === 0) return null;
  const top = arr[0];
  const last = arr.pop();
  if (arr.length === 0) return top;
  arr[0] = last;
  let i = 0;
  const n = arr.length;
  for (;;) {
    let j = i * 2 + 1;
    if (j >= n) break;
    let k = j + 1;
    if (k < n && arr[k][0] < arr[j][0]) j = k;
    if (arr[j][0] >= arr[i][0]) break;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    i = j;
  }
  return top;
}

/**
 * @param {number} R
 * @param {number} S
 * @param {number} D
 * @param {number} Ric
 * @param {number} R_cap
 * @param {number} S_cap
 * @param {number} D_cap
 * @param {number} aLaCarteCost
 */
function runDijkstra(R, S, D, Ric, R_cap, S_cap, D_cap, aLaCarteCost) {
  const dist = new Map();
  /** @type {Map<string, { prevKey: string; bundleId: number }>} */
  const parent = new Map();
  const heap = [];

  dist.set(key(0, 0, 0), 0);
  heapPush(heap, [0, 0, 0, 0]);

  while (heap.length) {
    const popped = heapPop(heap);
    if (!popped) break;
    const [cost, cr, cs, cd] = popped;
    const k = key(cr, cs, cd);
    if (cost > (dist.get(k) ?? Infinity)) continue;

    for (const b of THALI_BUNDLES) {
      const nr = Math.min(R_cap, cr + b.roti);
      const ns = Math.min(S_cap, cs + b.sabji);
      const nd = Math.min(D_cap, cd + b.dalRice);
      const nk = key(nr, ns, nd);
      const nc = cost + b.price;
      if (nc < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nc);
        parent.set(nk, { prevKey: k, bundleId: b.id });
        heapPush(heap, [nc, nr, ns, nd]);
      }
    }
  }

  let bestTotal = Infinity;
  let bestKey = "";
  for (const [k, thaliCost] of dist) {
    const [cr, cs, cd] = k.split(",").map(Number);
    const tail =
      Math.max(0, R - cr) * ROTI_PRICE +
      Math.max(0, S - cs) * SABJI_PRICE +
      Math.max(0, D - cd) * DAL_PRICE +
      Ric * RICE_PRICE;
    const t = thaliCost + tail;
    if (t < bestTotal) {
      bestTotal = t;
      bestKey = k;
    }
  }

  const thaliCounts = new Map();
  let cur = bestKey;
  const startK = key(0, 0, 0);
  while (cur && cur !== startK) {
    const p = parent.get(cur);
    if (!p) break;
    const bid = p.bundleId;
    thaliCounts.set(bid, (thaliCounts.get(bid) || 0) + 1);
    cur = p.prevKey;
  }

  const [br, bs, bd] = bestKey.split(",").map(Number);
  const leftoverRoti = Math.max(0, R - br);
  const leftoverSabji = Math.max(0, S - bs);
  const leftoverDal = Math.max(0, D - bd);
  const riceCost = Ric * RICE_PRICE;
  const thaliOnlyCost = dist.get(bestKey) ?? 0;
  const leftoverCost =
    leftoverRoti * ROTI_PRICE +
    leftoverSabji * SABJI_PRICE +
    leftoverDal * DAL_PRICE;

  const savings = Math.max(0, aLaCarteCost - bestTotal);

  return {
    hasDemand: true,
    skippedOptimizer: false,
    totalOptimized: bestTotal,
    aLaCarteCost,
    savings,
    thaliCounts,
    thaliOnlyCost,
    leftoverRoti,
    leftoverSabji,
    leftoverDal,
    riceCost,
    leftoverCost,
    coveredRoti: br,
    coveredSabji: bs,
    coveredDal: bd,
  };
}

/**
 * Compute total roti/sabji/dal-rice units implied by ordered thalis.
 * @param {Map<number, number>|undefined|null} thaliCounts
 */
function totalsFromOrderedThalis(thaliCounts) {
  let roti = 0;
  let sabji = 0;
  let dalRice = 0;
  let thaliCost = 0;

  if (!thaliCounts || thaliCounts.size === 0) {
    return { roti, sabji, dalRice, thaliCost };
  }

  for (const [id, nRaw] of thaliCounts.entries()) {
    const n = Number(nRaw) || 0;
    if (n <= 0) continue;
    const b = THALI_BY_ID.get(id);
    if (!b) continue;
    roti += b.roti * n;
    sabji += b.sabji * n;
    dalRice += b.dalRice * n;
    thaliCost += b.price * n;
  }

  return { roti, sabji, dalRice, thaliCost };
}

/**
 * Minimum-cost way to cover a range using thali bundles + à la carte remainder.
 *
 * By default this optimizes **extras only**. If `includeOrderedThalis` is true,
 * it re-optimizes the full ordered quantities (ordered thalis + extras).
 * @param {Record<string, unknown>} summary Return value of aggregateHistorySummary(rows)
 * @param {{ includeOrderedThalis?: boolean }|undefined} options
 */
export function optimizeExtrasForRange(summary, options) {
  const includeOrderedThalis = Boolean(options?.includeOrderedThalis);

  const extraR = Number(summary.rotiTotal) || 0;
  const extraS =
    (Number(summary.sabjiLegacyTotal) || 0) +
    (Number(summary.sabjiNamedPortions) || 0);
  const tc = summary.dalRiceTypeCounts || {};
  const extraD =
    (Number(tc.Pulav) || 0) +
    (Number(tc.Khichdi) || 0) +
    (Number(tc.Dalrice) || 0) +
    (Number(summary.dalRiceLegacyTotal) || 0);
  const Ric = Number(summary.riceTotal) || 0;

  const ordered = includeOrderedThalis
    ? totalsFromOrderedThalis(summary.thaliCounts)
    : { roti: 0, sabji: 0, dalRice: 0, thaliCost: 0 };

  const R = extraR + ordered.roti;
  const S = extraS + ordered.sabji;
  const D = extraD + ordered.dalRice;

  const aLaCarteCost =
    R * ROTI_PRICE + S * SABJI_PRICE + D * DAL_PRICE + Ric * RICE_PRICE;

  const currentPaidCost =
    ordered.thaliCost +
    extraR * ROTI_PRICE +
    extraS * SABJI_PRICE +
    extraD * DAL_PRICE +
    Ric * RICE_PRICE;

  if (R === 0 && S === 0 && D === 0 && Ric === 0) {
    return {
      hasDemand: false,
      aLaCarteCost: 0,
      totalOptimized: 0,
      savings: 0,
      savingsVsCurrent: 0,
      currentPaidCost: 0,
      thaliCounts: new Map(),
      skippedOptimizer: false,
      riceCost: 0,
      mode: includeOrderedThalis ? "full" : "extras",
    };
  }

  if (R > 600 || S > 250 || D > 250) {
    return {
      hasDemand: true,
      skippedOptimizer: true,
      note: "Totals are too large for the bundle calculator; showing current total only.",
      aLaCarteCost,
      totalOptimized: currentPaidCost,
      savings: 0,
      savingsVsCurrent: 0,
      currentPaidCost,
      thaliCounts: new Map(),
      riceCost: Ric * RICE_PRICE,
      leftoverRoti: R,
      leftoverSabji: S,
      leftoverDal: D,
      leftoverCost: R * ROTI_PRICE + S * SABJI_PRICE + D * DAL_PRICE,
      thaliOnlyCost: 0,
      mode: includeOrderedThalis ? "full" : "extras",
    };
  }

  if (R === 0 && S === 0 && D === 0 && Ric > 0) {
    const riceCost = Ric * RICE_PRICE;
    return {
      hasDemand: true,
      skippedOptimizer: false,
      aLaCarteCost,
      totalOptimized: riceCost,
      savings: 0,
      savingsVsCurrent: Math.max(0, currentPaidCost - riceCost),
      currentPaidCost,
      thaliCounts: new Map(),
      riceCost,
      leftoverRoti: 0,
      leftoverSabji: 0,
      leftoverDal: 0,
      leftoverCost: 0,
      thaliOnlyCost: 0,
      note: "Rice only — no thali bundles apply.",
      mode: includeOrderedThalis ? "full" : "extras",
    };
  }

  const maxR = Math.max(...THALI_BUNDLES.map((b) => b.roti));
  const maxS = Math.max(...THALI_BUNDLES.map((b) => b.sabji));
  const maxD = Math.max(...THALI_BUNDLES.map((b) => b.dalRice));
  const R_cap = Math.min(R + maxR, 400);
  const S_cap = Math.min(S + maxS, 200);
  const D_cap = Math.min(D + maxD, 200);

  const result = runDijkstra(R, S, D, Ric, R_cap, S_cap, D_cap, aLaCarteCost);
  const savingsVsCurrent = Math.max(0, currentPaidCost - result.totalOptimized);
  return {
    ...result,
    currentPaidCost,
    savingsVsCurrent,
    mode: includeOrderedThalis ? "full" : "extras",
  };
}

const THALI_PRICE_BY_ID = new Map(
  THALI_BUNDLES.map((b) => [b.id, b.price])
);

/**
 * @param {Map<number, number>} thaliCounts
 * @returns {string} e.g. "Thali 2(rs.110) x 1, Thali 5(rs.75) x 1"
 */
export function formatOptimizedThaliLine(thaliCounts) {
  if (!thaliCounts || thaliCounts.size === 0) return "";
  return [...thaliCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => {
      const unit = THALI_PRICE_BY_ID.get(id) ?? 0;
      return `Thali ${id}(rs.${unit}) x ${n}`;
    })
    .join(", ");
}
