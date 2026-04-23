import { Order } from "../models/Order.js";
import { THALI_PRICES } from "../pricing.js";

type DalRiceType = "Pulav" | "Khichdi" | "Dalrice";

type ReportHistoryRow = {
  createdAtIso: string;
  createdAtIst: string;
  userName: string;
  userPhone: string;
  thaliLine: string;
  extrasLine: string;
  description: string;
  totalAmount: number;
};

type ReportSummary = {
  orderCount: number;
  totalAmount: number;
  rotiTotal: number;
  riceTotal: number;
  sabjiTotal: number;
  dalRiceTotal: number;
  thaliCountsLine: string;
};

type ReportOptimization = {
  hasDemand: boolean;
  currentPaidCost: number;
  totalOptimized: number;
  savings: number;
  optimizedThaliLine: string;
  leftoverLine: string;
  demandLine: string;
};

export type DailyOrderReport = {
  dateKey: string;
  hasOrders: boolean;
  historyRows: ReportHistoryRow[];
  summary: ReportSummary;
  optimization: ReportOptimization;
};

type ExtraItemsLike = {
  roti?: unknown;
  rice?: unknown;
  sabji1?: unknown;
  sabji2?: unknown;
  dalRiceType?: unknown;
  sabji?: unknown;
  dalRice?: unknown;
};

type OrderDocLike = {
  userId?: unknown;
  thaliIds?: unknown;
  thaliId?: unknown;
  description?: unknown;
  extraItems?: ExtraItemsLike;
  totalAmount?: unknown;
  createdAt?: unknown;
};

type SummaryAccumulator = {
  rotiTotal: number;
  riceTotal: number;
  sabjiLegacyTotal: number;
  sabjiNamedPortions: number;
  dalRiceTypeCounts: Record<DalRiceType, number>;
  dalRiceLegacyTotal: number;
  thaliCounts: Map<number, number>;
  totalAmount: number;
  orderCount: number;
};

type Bundle = {
  id: number;
  roti: number;
  sabji: number;
  dalRice: number;
  price: number;
};

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const EXTRA_PRICES = {
  roti: Number(process.env.ROTI_PRICE || 10),
  sabji: Number(process.env.SABJI_UNIT_PRICE || 40),
  dalRice: Number(process.env.DAL_RICE_UNIT_PRICE || 40),
  rice: Number(process.env.RICE_PRICE || 30),
};

const THALI_BUNDLES: Bundle[] = [
  { id: 1, price: THALI_PRICES[1], roti: 5, sabji: 2, dalRice: 1 },
  { id: 2, price: THALI_PRICES[2], roti: 8, sabji: 2, dalRice: 0 },
  { id: 3, price: THALI_PRICES[3], roti: 5, sabji: 1, dalRice: 1 },
  { id: 4, price: THALI_PRICES[4], roti: 5, sabji: 2, dalRice: 0 },
  { id: 5, price: THALI_PRICES[5], roti: 5, sabji: 1, dalRice: 0 },
];

const THALI_BY_ID = new Map(THALI_BUNDLES.map((b) => [b.id, b]));

function getIstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function safeInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function mergedThaliIds(row: OrderDocLike): number[] {
  if (Array.isArray(row.thaliIds)) {
    return row.thaliIds
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= 5);
  }
  const id = Number(row.thaliId);
  if (Number.isInteger(id) && id >= 1 && id <= 5) return [id];
  return [];
}

function formatThaliCountsLine(thaliCounts: Map<number, number>): string {
  if (thaliCounts.size === 0) return "—";
  return [...thaliCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, qty]) => `Thali ${id} x ${qty}`)
    .join(", ");
}

function formatOrderThaliLine(ids: number[]): string {
  if (ids.length === 0) return "—";
  const map = new Map<number, number>();
  for (const id of ids) map.set(id, (map.get(id) || 0) + 1);
  return formatThaliCountsLine(map);
}

function formatOrderExtrasLine(extra: ExtraItemsLike | undefined): string {
  if (!extra) return "—";
  const parts: string[] = [];
  const roti = safeInt(extra.roti);
  const rice = safeInt(extra.rice);
  if (roti > 0) parts.push(`Roti ${roti}`);
  if (rice > 0) parts.push(`Rice ${rice}`);
  const s1 = typeof extra.sabji1 === "string" ? extra.sabji1.trim() : "";
  const s2 = typeof extra.sabji2 === "string" ? extra.sabji2.trim() : "";
  if (s1) parts.push(`Sabji ${s1}`);
  if (s2) parts.push(`Sabji ${s2}`);
  const dr = typeof extra.dalRiceType === "string" ? extra.dalRiceType.trim() : "";
  if (dr) parts.push(`Dal-rice ${dr}`);
  const legacySabji = safeInt(extra.sabji);
  const legacyDal = safeInt(extra.dalRice);
  if (!s1 && !s2 && legacySabji > 0) parts.push(`Sabji ${legacySabji}`);
  if (!dr && legacyDal > 0) parts.push(`Dal-rice ${legacyDal}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function readUserNameAndPhone(rawUser: unknown): { name: string; phone: string } {
  if (rawUser && typeof rawUser === "object" && rawUser !== null) {
    const r = rawUser as { name?: unknown; phone?: unknown };
    return {
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Unknown user",
      phone: typeof r.phone === "string" ? r.phone : "",
    };
  }
  return { name: "Unknown user", phone: "" };
}

function accumulateSummary(rows: OrderDocLike[]): SummaryAccumulator {
  const out: SummaryAccumulator = {
    rotiTotal: 0,
    riceTotal: 0,
    sabjiLegacyTotal: 0,
    sabjiNamedPortions: 0,
    dalRiceTypeCounts: { Pulav: 0, Khichdi: 0, Dalrice: 0 },
    dalRiceLegacyTotal: 0,
    thaliCounts: new Map<number, number>(),
    totalAmount: 0,
    orderCount: 0,
  };

  for (const row of rows) {
    out.orderCount += 1;
    out.totalAmount += Number(row.totalAmount) || 0;
    const ids = mergedThaliIds(row);
    for (const id of ids) {
      out.thaliCounts.set(id, (out.thaliCounts.get(id) || 0) + 1);
    }

    const extra = row.extraItems;
    if (!extra) continue;
    out.rotiTotal += safeInt(extra.roti);
    out.riceTotal += safeInt(extra.rice);

    const sabji1 = typeof extra.sabji1 === "string" ? extra.sabji1.trim() : "";
    const sabji2 = typeof extra.sabji2 === "string" ? extra.sabji2.trim() : "";
    if (sabji1 || sabji2) {
      if (sabji1) out.sabjiNamedPortions += 1;
      if (sabji2) out.sabjiNamedPortions += 1;
    } else {
      out.sabjiLegacyTotal += safeInt(extra.sabji);
    }

    const dr = typeof extra.dalRiceType === "string" ? extra.dalRiceType : "";
    if (dr === "Pulav" || dr === "Khichdi" || dr === "Dalrice") {
      out.dalRiceTypeCounts[dr] += 1;
    } else {
      out.dalRiceLegacyTotal += safeInt(extra.dalRice);
    }
  }

  return out;
}

function totalsFromOrderedThalis(thaliCounts: Map<number, number>): {
  roti: number;
  sabji: number;
  dalRice: number;
  thaliCost: number;
} {
  let roti = 0;
  let sabji = 0;
  let dalRice = 0;
  let thaliCost = 0;
  for (const [id, qtyRaw] of thaliCounts.entries()) {
    const qty = Number(qtyRaw) || 0;
    if (qty <= 0) continue;
    const bundle = THALI_BY_ID.get(id);
    if (!bundle) continue;
    roti += bundle.roti * qty;
    sabji += bundle.sabji * qty;
    dalRice += bundle.dalRice * qty;
    thaliCost += bundle.price * qty;
  }
  return { roti, sabji, dalRice, thaliCost };
}

function heapPush(arr: number[][], item: number[]) {
  arr.push(item);
  let i = arr.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if ((arr[p]?.[0] ?? 0) <= (arr[i]?.[0] ?? 0)) break;
    [arr[i], arr[p]] = [arr[p], arr[i]];
    i = p;
  }
}

function heapPop(arr: number[][]): number[] | null {
  if (arr.length === 0) return null;
  const top = arr[0];
  const last = arr.pop();
  if (arr.length === 0) return top ?? null;
  if (!last) return top ?? null;
  arr[0] = last;
  let i = 0;
  while (true) {
    let j = i * 2 + 1;
    if (j >= arr.length) break;
    const k = j + 1;
    if (k < arr.length && (arr[k]?.[0] ?? 0) < (arr[j]?.[0] ?? 0)) j = k;
    if ((arr[j]?.[0] ?? 0) >= (arr[i]?.[0] ?? 0)) break;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    i = j;
  }
  return top ?? null;
}

function optimizeFullDemand(summary: SummaryAccumulator): ReportOptimization {
  const ordered = totalsFromOrderedThalis(summary.thaliCounts);
  const extraR = summary.rotiTotal;
  const extraS = summary.sabjiLegacyTotal + summary.sabjiNamedPortions;
  const extraD =
    summary.dalRiceTypeCounts.Pulav +
    summary.dalRiceTypeCounts.Khichdi +
    summary.dalRiceTypeCounts.Dalrice +
    summary.dalRiceLegacyTotal;
  const rice = summary.riceTotal;

  const R = ordered.roti + extraR;
  const S = ordered.sabji + extraS;
  const D = ordered.dalRice + extraD;

  const currentPaidCost =
    ordered.thaliCost +
    extraR * EXTRA_PRICES.roti +
    extraS * EXTRA_PRICES.sabji +
    extraD * EXTRA_PRICES.dalRice +
    rice * EXTRA_PRICES.rice;

  if (R === 0 && S === 0 && D === 0 && rice === 0) {
    return {
      hasDemand: false,
      currentPaidCost: 0,
      totalOptimized: 0,
      savings: 0,
      optimizedThaliLine: "—",
      leftoverLine: "—",
      demandLine: "No demand today.",
    };
  }

  const maxR = Math.max(...THALI_BUNDLES.map((b) => b.roti));
  const maxS = Math.max(...THALI_BUNDLES.map((b) => b.sabji));
  const maxD = Math.max(...THALI_BUNDLES.map((b) => b.dalRice));
  const RCap = Math.min(R + maxR, 400);
  const SCap = Math.min(S + maxS, 200);
  const DCap = Math.min(D + maxD, 200);

  const key = (r: number, s: number, d: number) => `${r},${s},${d}`;
  const dist = new Map<string, number>();
  const parent = new Map<string, { prevKey: string; bundleId: number }>();
  const heap: number[][] = [];
  dist.set(key(0, 0, 0), 0);
  heapPush(heap, [0, 0, 0, 0]);

  while (heap.length > 0) {
    const popped = heapPop(heap);
    if (!popped) break;
    const [cost, cr, cs, cd] = popped;
    const k = key(cr, cs, cd);
    if (cost > (dist.get(k) ?? Number.POSITIVE_INFINITY)) continue;
    for (const b of THALI_BUNDLES) {
      const nr = Math.min(RCap, cr + b.roti);
      const ns = Math.min(SCap, cs + b.sabji);
      const nd = Math.min(DCap, cd + b.dalRice);
      const nk = key(nr, ns, nd);
      const nc = cost + b.price;
      if (nc < (dist.get(nk) ?? Number.POSITIVE_INFINITY)) {
        dist.set(nk, nc);
        parent.set(nk, { prevKey: k, bundleId: b.id });
        heapPush(heap, [nc, nr, ns, nd]);
      }
    }
  }

  let bestTotal = Number.POSITIVE_INFINITY;
  let bestKey = key(0, 0, 0);
  for (const [k, thaliCost] of dist.entries()) {
    const [cr, cs, cd] = k.split(",").map(Number);
    const tail =
      Math.max(0, R - cr) * EXTRA_PRICES.roti +
      Math.max(0, S - cs) * EXTRA_PRICES.sabji +
      Math.max(0, D - cd) * EXTRA_PRICES.dalRice +
      rice * EXTRA_PRICES.rice;
    const total = thaliCost + tail;
    if (total < bestTotal) {
      bestTotal = total;
      bestKey = k;
    }
  }

  const optimizedCounts = new Map<number, number>();
  let cur = bestKey;
  const start = key(0, 0, 0);
  while (cur !== start) {
    const p = parent.get(cur);
    if (!p) break;
    optimizedCounts.set(p.bundleId, (optimizedCounts.get(p.bundleId) || 0) + 1);
    cur = p.prevKey;
  }
  const [br, bs, bd] = bestKey.split(",").map(Number);
  const leftoverR = Math.max(0, R - br);
  const leftoverS = Math.max(0, S - bs);
  const leftoverD = Math.max(0, D - bd);
  const leftoverBits: string[] = [];
  if (leftoverR > 0) leftoverBits.push(`Roti ${leftoverR}`);
  if (leftoverS > 0) leftoverBits.push(`Sabji ${leftoverS}`);
  if (leftoverD > 0) leftoverBits.push(`Dal-rice ${leftoverD}`);
  if (rice > 0) leftoverBits.push(`Rice ${rice}`);

  const optimizedThaliLine = optimizedCounts.size
    ? [...optimizedCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, qty]) => `Thali ${id}(₹${THALI_PRICES[id] ?? 0}) x ${qty}`)
        .join(", ")
    : "—";

  return {
    hasDemand: true,
    currentPaidCost,
    totalOptimized: bestTotal,
    savings: Math.max(0, currentPaidCost - bestTotal),
    optimizedThaliLine,
    leftoverLine: leftoverBits.length ? leftoverBits.join(", ") : "None",
    demandLine: `Demand covered: Roti ${R}, Sabji ${S}, Dal-rice ${D}, Rice ${rice}`,
  };
}

export function getTodayDateKeyIST(): string {
  return getIstDateKey(new Date());
}

export async function buildDailyOrderReport(dateKey = getTodayDateKeyIST()): Promise<DailyOrderReport> {
  const docsRaw = await Order.find({
    dateKey,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .populate("userId", "name phone")
    .lean();

  const docs = docsRaw as unknown as OrderDocLike[];
  const summaryAcc = accumulateSummary(docs);
  const historyRows: ReportHistoryRow[] = docs.map((row) => {
    const user = readUserNameAndPhone(row.userId);
    const createdAt = row.createdAt ? new Date(String(row.createdAt)) : new Date();
    return {
      createdAtIso: createdAt.toISOString(),
      createdAtIst: IST_DATE_TIME_FORMATTER.format(createdAt),
      userName: user.name,
      userPhone: user.phone,
      thaliLine: formatOrderThaliLine(mergedThaliIds(row)),
      extrasLine: formatOrderExtrasLine(row.extraItems),
      description:
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim()
          : "—",
      totalAmount: Number(row.totalAmount) || 0,
    };
  });

  const summary: ReportSummary = {
    orderCount: summaryAcc.orderCount,
    totalAmount: summaryAcc.totalAmount,
    rotiTotal: summaryAcc.rotiTotal,
    riceTotal: summaryAcc.riceTotal,
    sabjiTotal: summaryAcc.sabjiLegacyTotal + summaryAcc.sabjiNamedPortions,
    dalRiceTotal:
      summaryAcc.dalRiceTypeCounts.Pulav +
      summaryAcc.dalRiceTypeCounts.Khichdi +
      summaryAcc.dalRiceTypeCounts.Dalrice +
      summaryAcc.dalRiceLegacyTotal,
    thaliCountsLine: formatThaliCountsLine(summaryAcc.thaliCounts),
  };

  return {
    dateKey,
    hasOrders: summary.orderCount > 0,
    historyRows,
    summary,
    optimization: optimizeFullDemand(summaryAcc),
  };
}
