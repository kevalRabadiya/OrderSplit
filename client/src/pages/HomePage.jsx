import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DailyExpenseCandlestick from "../components/DailyExpenseCandlestick.jsx";
import Loader from "../components/Loader.jsx";
import {
  getDeposit,
  getHousekeeperAttendance,
  getLightBillsForYear,
  getOrdersHistory,
  getUsers,
} from "../api";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";
import {
  computeDailyOptimization,
  computeEqualSplitByDay,
} from "../utils/dailyOptimization.js";
import { useTheme } from "../theme/useTheme.js";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** @param {string} ym `YYYY-MM` */
function monthToDateRange(ym) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return monthToDateRange(currentMonthValue());
  }
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${y}-${pad(m)}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${pad(m)}-${pad(last)}`;
  return { from, to };
}

/** e.g. "April 2026" */
function monthHumanLabel(ym) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return ym;
  }
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function lookbackFromISO(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDateKeyInRange(from, to) {
  const keys = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

/** @param {string} ym `YYYY-MM` */
function shortMonthNameEnIn(ym) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" });
}

/** e.g. Jan–Feb, or Dec '25–Jan '26 when crossing years */
function formatLightBillPeriodLabel(fromM, toM) {
  if (fromM === toM) return shortMonthNameEnIn(fromM);
  const [fy] = fromM.split("-").map(Number);
  const [ty] = toM.split("-").map(Number);
  const a = shortMonthNameEnIn(fromM);
  const b = shortMonthNameEnIn(toM);
  if (fy === ty) return `${a}–${b}`;
  return `${a} '${String(fy).slice(2)}–${b} '${String(ty).slice(2)}`;
}

function lightBillPeriodOverlapsYear(fromM, toM, year) {
  const yStart = `${year}-01`;
  const yEnd = `${year}-12`;
  return fromM <= yEnd && toM >= yStart;
}

function aggregateMonthOrders(orders, from, to) {
  let totalAmount = 0;
  const byDay = new Map();
  const byUser = new Map();

  for (const k of eachDateKeyInRange(from, to)) {
    byDay.set(k, { amount: 0, count: 0 });
  }

  for (const row of orders) {
    const amt = Number(row.totalAmount) || 0;
    totalAmount += amt;
    const uid = String(row.userId ?? "");
    if (!byUser.has(uid)) {
      byUser.set(uid, { count: 0, amount: 0 });
    }
    const u = byUser.get(uid);
    u.count += 1;
    u.amount += amt;

    const dk = row.dateKey;
    if (dk && byDay.has(dk)) {
      const day = byDay.get(dk);
      day.amount += amt;
      day.count += 1;
    }
  }

  const dailyChart = eachDateKeyInRange(from, to).map((dateKey) => {
    const v = byDay.get(dateKey);
    const dom = Number(dateKey.slice(8, 10));
    return {
      dateKey,
      day: dom,
      amount: v.amount,
      orders: v.count,
    };
  });

  const topCustomers = [...byUser.entries()]
    .filter(([id]) => id)
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    orderCount: orders.length,
    totalAmount,
    dailyChart,
    byUser,
    topCustomers,
  };
}

function buildDailyOptimizationChart(dayMap, from, to) {
  return eachDateKeyInRange(from, to).map((dateKey) => {
    const dom = Number(dateKey.slice(8, 10));
    const m = dayMap.get(dateKey);
    return {
      dateKey,
      day: dom,
      currentTotal: m ? m.currentTotal : 0,
      optimizedTotal: m ? m.optimizedTotal : 0,
    };
  });
}

/** Matches `index.css` :root / [data-theme="dark"] chart-relevant tokens. */
const CHART_THEME = {
  light: {
    accent: "#c2410c",
    text: "#57534e",
    textHeading: "#1c1917",
    border: "#e7e2dc",
    grid: "#e7e2dc",
  },
  dark: {
    accent: "#fb923c",
    text: "#b8b3ad",
    textHeading: "#fafaf9",
    border: "#57534e",
    grid: "#57534e",
  },
};

function useChartThemeColors() {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => CHART_THEME[resolvedTheme] ?? CHART_THEME.light,
    [resolvedTheme]
  );
}

export default function HomePage() {
  const chartColors = useChartThemeColors();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [chartMonth, setChartMonth] = useState(currentMonthValue);
  const [users, setUsers] = useState([]);
  const [monthOrders, setMonthOrders] = useState([]);
  const [housekeeperRows, setHousekeeperRows] = useState([]);
  const [housekeeperYearRows, setHousekeeperYearRows] = useState([]);
  const [lightBillYearRows, setLightBillYearRows] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [monthOrdersLoading, setMonthOrdersLoading] = useState(true);
  const [monthOrdersError, setMonthOrdersError] = useState(null);
  const [hkMonthLoading, setHkMonthLoading] = useState(true);
  const [hkMonthError, setHkMonthError] = useState(null);
  const [hkYearLoading, setHkYearLoading] = useState(true);
  const [hkYearError, setHkYearError] = useState(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState(null);
  const [lightLoading, setLightLoading] = useState(true);
  const [lightError, setLightError] = useState(null);
  const [depositTotalAmount, setDepositTotalAmount] = useState(0);
  const [depositLoading, setDepositLoading] = useState(true);
  const [depositError, setDepositError] = useState(null);

  const range = useMemo(() => monthToDateRange(chartMonth), [chartMonth]);
  const selectedYear = useMemo(() => {
    const y = Number(String(chartMonth || "").slice(0, 4));
    return Number.isFinite(y) ? y : currentYear;
  }, [chartMonth, currentYear]);
  const today = useMemo(() => todayISO(), []);
  const lookbackFrom = useMemo(() => lookbackFromISO(120), []);
  const yearlyRange = useMemo(() => {
    const y = Number(selectedYear);
    if (!Number.isFinite(y)) return { from: `${currentYear}-01-01`, to: today };
    if (y >= currentYear) return { from: `${currentYear}-01-01`, to: today };
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }, [currentYear, selectedYear, today]);

  const stats = useMemo(
    () => aggregateMonthOrders(monthOrders, range.from, range.to),
    [monthOrders, range.from, range.to]
  );

  const dailyOptimization = useMemo(
    () => computeDailyOptimization(monthOrders),
    [monthOrders]
  );

  const split = useMemo(() => computeEqualSplitByDay(monthOrders), [monthOrders]);

  const dailyOptimizationChart = useMemo(
    () => buildDailyOptimizationChart(dailyOptimization, range.from, range.to),
    [dailyOptimization, range.from, range.to]
  );

  const dailyCandlestickData = useMemo(() => {
    const rangeKeys = eachDateKeyInRange(range.from, range.to);
    const ordersByDate = new Map(
      stats.dailyChart.map((d) => [d.dateKey, Number(d.orders) || 0])
    );
    return rangeKeys.reduce((rows, dateKey) => {
      const m = dailyOptimization.get(dateKey);
      const opt = m?.optimizedTotal ?? 0;
      const cur = m?.currentTotal ?? 0;
      const prevClose = rows.length ? rows[rows.length - 1].close : 0;
      const open = prevClose;
      const close = opt;
      const high = Math.max(open, close, cur);
      const low = Math.min(open, close, cur);
      const dom = Number(dateKey.slice(8, 10));
      rows.push({
        dateKey,
        day: dom,
        open,
        high: Math.max(high, low),
        low,
        close,
        currentTotal: cur,
        orders: ordersByDate.get(dateKey) ?? 0,
      });
      return rows;
    }, []);
  }, [dailyOptimization, range.from, range.to, stats.dailyChart]);

  const optimizedMonthTotal = useMemo(() => {
    let sum = 0;
    for (const dateKey of eachDateKeyInRange(range.from, range.to)) {
      sum += dailyOptimization.get(dateKey)?.optimizedTotal ?? 0;
    }
    return sum;
  }, [dailyOptimization, range.from, range.to]);

  const housekeeperDays = useMemo(
    () =>
      housekeeperRows.filter((r) => r?.present && typeof r?.dateKey === "string")
        .length,
    [housekeeperRows]
  );
  const housekeeperRate = Number(import.meta.env.VITE_HOUSEKEEPER_RATE_PER_DAY) || 0;
  const housekeeperAmount = housekeeperDays * housekeeperRate;

  const housekeeperMonthlyChartData = useMemo(() => {
    const year = Number(selectedYear);
    const presentByMonth = new Map();
    for (const row of housekeeperYearRows) {
      if (!row?.present || typeof row?.dateKey !== "string") continue;
      const mk = row.dateKey.slice(0, 7);
      presentByMonth.set(mk, (presentByMonth.get(mk) || 0) + 1);
    }
    const monthNow = year >= currentYear ? Number(today.slice(5, 7)) : 12;
    const out = [];
    for (let m = 1; m <= monthNow; m += 1) {
      const monthKey = `${year}-${String(m).padStart(2, "0")}`;
      const days = presentByMonth.get(monthKey) || 0;
      out.push({
        monthKey,
        monthLabel: new Date(year, m - 1, 1).toLocaleString("en-IN", { month: "short" }),
        days,
        amount: days * housekeeperRate,
      });
    }
    return out;
  }, [currentYear, housekeeperRate, housekeeperYearRows, selectedYear, today]);

  const lightBillPeriodChartData = useMemo(() => {
    const year = Number(selectedYear);
    const out = [];
    for (const row of lightBillYearRows) {
      const fromM = row?.fromMonthKey;
      const toM = row?.toMonthKey;
      if (typeof fromM !== "string" || typeof toM !== "string") continue;
      if (fromM > toM) continue;
      if (!lightBillPeriodOverlapsYear(fromM, toM, year)) continue;
      const amt = Number(row.amount);
      if (!Number.isFinite(amt)) continue;
      out.push({
        periodKey: `${fromM}|${toM}`,
        periodLabel: formatLightBillPeriodLabel(fromM, toM),
        rangeLabel: `${fromM} – ${toM}`,
        amount: amt,
      });
    }
    out.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    return out;
  }, [lightBillYearRows, selectedYear]);

  const topOptimizedUsers = useMemo(() => {
    const totals = new Map();
    for (const dateKey of eachDateKeyInRange(range.from, range.to)) {
      const m = split.dayMap.get(dateKey);
      if (!m) continue;
      for (const uid of m.userIds) {
        totals.set(uid, (totals.get(uid) || 0) + m.share);
      }
    }
    return [...totals.entries()]
      .map(([userId, amount]) => ({ userId, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [split.dayMap, range.from, range.to]);

  // const periodBadgePrefix =
  //   chartMonth === currentMonthValue() ? "This month" : monthHumanLabel(chartMonth);

  const topCustomersWithNames = useMemo(() => {
    const map = new Map(users.map((u) => [String(u._id), u.name]));
    return topOptimizedUsers.map((c) => ({
      ...c,
      name: map.get(c.userId) || "User",
      label: (map.get(c.userId) || "User").slice(0, 18),
    }));
  }, [topOptimizedUsers, users]);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    (async () => {
      try {
        const userList = await getUsers();
        if (!cancelled) {
          setUsers(Array.isArray(userList) ? userList : []);
          setUsersError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setUsers([]);
          setUsersError(e?.message || "Failed to load users");
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMonthOrdersLoading(true);
    setMonthOrdersError(null);
    (async () => {
      try {
        const monthRows = await getOrdersHistory({
          from: range.from,
          to: range.to,
        });
        if (!cancelled) {
          setMonthOrders(Array.isArray(monthRows) ? monthRows : []);
          setMonthOrdersError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setMonthOrders([]);
          setMonthOrdersError(e?.message || "Failed to load orders");
        }
      } finally {
        if (!cancelled) setMonthOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  useEffect(() => {
    let cancelled = false;
    setHkMonthLoading(true);
    setHkMonthError(null);
    (async () => {
      try {
        const housekeeperList = await getHousekeeperAttendance({
          from: range.from,
          to: range.to,
        });
        if (!cancelled) {
          setHousekeeperRows(
            Array.isArray(housekeeperList) ? housekeeperList : []
          );
          setHkMonthError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setHousekeeperRows([]);
          setHkMonthError(e?.message || "Failed to load attendance");
        }
      } finally {
        if (!cancelled) setHkMonthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  useEffect(() => {
    let cancelled = false;
    setHkYearLoading(true);
    setHkYearError(null);
    (async () => {
      try {
        const housekeeperYearList = await getHousekeeperAttendance({
          from: yearlyRange.from,
          to: yearlyRange.to,
        });
        if (!cancelled) {
          setHousekeeperYearRows(
            Array.isArray(housekeeperYearList) ? housekeeperYearList : []
          );
          setHkYearError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setHousekeeperYearRows([]);
          setHkYearError(e?.message || "Failed to load attendance");
        }
      } finally {
        if (!cancelled) setHkYearLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yearlyRange.from, yearlyRange.to]);

  useEffect(() => {
    let cancelled = false;
    setRecentLoading(true);
    setRecentError(null);
    (async () => {
      try {
        const recentRows = await getOrdersHistory({
          from: lookbackFrom,
          to: today,
        });
        if (!cancelled) {
          const sorted = Array.isArray(recentRows) ? recentRows : [];
          setRecentOrders(sorted.slice(0, 4));
          setRecentError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRecentOrders([]);
          setRecentError(e?.message || "Failed to load recent orders");
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookbackFrom, today]);

  useEffect(() => {
    let cancelled = false;
    setLightLoading(true);
    setLightError(null);
    const year = Number(selectedYear);
    (async () => {
      try {
        const lightRows = await getLightBillsForYear(year);
        if (!cancelled) {
          setLightBillYearRows(Array.isArray(lightRows) ? lightRows : []);
          setLightError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLightBillYearRows([]);
          setLightError(e?.message || "Failed to load light bills");
        }
      } finally {
        if (!cancelled) setLightLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    let cancelled = false;
    setDepositLoading(true);
    setDepositError(null);
    (async () => {
      try {
        const row = await getDeposit();
        if (!cancelled) {
          const amount = Number(row?.totalAmount);
          setDepositTotalAmount(Number.isFinite(amount) ? amount : 0);
          setDepositError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDepositTotalAmount(0);
          setDepositError(e?.message || "Failed to load deposit");
        }
      } finally {
        if (!cancelled) setDepositLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthLabelShort = `${chartMonth.slice(5, 7)}/${chartMonth.slice(0, 4)}`;
  const rangeDisplay = `${formatDateDDMMYYYY(range.from)} – ${formatDateDDMMYYYY(range.to)}`;

  return (
    <div className="page page--wide home-dashboard home-dashboard--glass premium-shell">
      <div className="page-head home-dashboard-head glass-hero premium-hero motion-fade-up">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Home</h1>
          <p className="lede muted mb-0">
            Charts for <strong>{monthHumanLabel(chartMonth)}</strong> (
            {rangeDisplay}). Pick any month below. Recent orders and user list
            stay below.
          </p>
        </div>
        <div className="home-dashboard-actions">
          {/*           <Link to="/users" className="btn btn-ghost">
            All users
          </Link> */}
          <Link to="/order" className="btn primary">
            New order
          </Link>
        </div>
      </div>

      <div className="card-elevated invoice-toolbar home-month-toolbar glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-1">
        <label className="invoice-month-label">
          <span className="form-section-title invoice-month-title">
            Month for charts
          </span>
          <input
            type="month"
            value={chartMonth}
            onChange={(e) => setChartMonth(e.target.value)}
            className="invoice-month-input"
            max={currentMonthValue()}
          />
        </label>
        <p className="muted invoice-range-hint mb-0">
          <strong>{monthHumanLabel(chartMonth)}</strong>
          <span className="small muted"> · {monthLabelShort}</span>
          <br />
          <span className="small">{rangeDisplay}</span>
        </p>
      </div>

      <div className="home-stat-grid">
        <div className="card-elevated home-stat-card glass-surface glass-panel-3d depth-card neon-edge motion-lift motion-fade-up motion-delay-1">
          <p className="home-stat-label muted mb-0">Orders</p>
          <p className="home-stat-sublabel muted small mb-0">
            {monthHumanLabel(chartMonth)}
          </p>
          <div className="home-stat-value">
            {monthOrdersLoading ? (
              <Loader variant="inline" label="Loading orders…" />
            ) : monthOrdersError ? (
              <span className="small muted" role="alert">
                {monthOrdersError}
              </span>
            ) : (
              stats.orderCount
            )}
          </div>
        </div>
        <div className="card-elevated home-stat-card home-stat-card--accent glass-surface glass-panel-3d depth-card neon-edge motion-lift motion-fade-up motion-delay-1">
          <p className="home-stat-label mb-0">Expence</p>
          <p className="home-stat-sublabel muted small mb-0">
            {monthHumanLabel(chartMonth)}
          </p>
          <div className="home-stat-value">
            {monthOrdersLoading ? (
              <Loader variant="inline" label="Loading totals…" />
            ) : monthOrdersError ? (
              <span className="small muted" role="alert">
                {monthOrdersError}
              </span>
            ) : (
              <>₹{optimizedMonthTotal}</>
            )}
          </div>
        </div>
        <div className="card-elevated home-stat-card glass-surface glass-panel-3d depth-card neon-edge motion-lift motion-fade-up motion-delay-2">
          <p className="home-stat-label muted mb-0">Users</p>
          <div className="home-stat-value">
            {usersLoading ? (
              <Loader variant="inline" label="Loading users…" />
            ) : usersError ? (
              <span className="small muted" role="alert">
                {usersError}
              </span>
            ) : (
              users.length
            )}
          </div>
        </div>
        <div className="card-elevated home-stat-card home-stat-card--housekeeper glass-surface glass-panel-3d depth-card neon-edge motion-lift motion-fade-up motion-delay-2">
          <p className="home-stat-label mb-0">HouseKeeper</p>
          <p className="home-stat-sublabel muted small mb-0">
            {hkMonthLoading ? (
              <span className="muted">Loading…</span>
            ) : hkMonthError ? null : (
              <>
                {housekeeperDays} day{housekeeperDays === 1 ? "" : "s"} × ₹
                {housekeeperRate}
              </>
            )}
          </p>
          <div className="home-stat-value">
            {hkMonthLoading ? (
              <Loader variant="inline" label="Loading…" />
            ) : hkMonthError ? (
              <span className="small muted" role="alert">
                {hkMonthError}
              </span>
            ) : (
              <>₹{housekeeperAmount}</>
            )}
          </div>
        </div>
        <div className="card-elevated home-stat-card glass-surface glass-panel-3d depth-card neon-edge motion-lift motion-fade-up motion-delay-2">
          <p className="home-stat-label muted mb-0">Deposit</p>
          <p className="home-stat-sublabel muted small mb-0">Current pool</p>
          <div className="home-stat-value">
            {depositLoading ? (
              <Loader variant="inline" label="Loading deposit…" />
            ) : depositError ? (
              <span className="small muted" role="alert">
                {depositError}
              </span>
            ) : (
              <>₹{depositTotalAmount}</>
            )}
          </div>
          <p className="small muted mb-0">
            <Link to="/deposit" className="home-section-link">
              Manage →
            </Link>
          </p>
        </div>
      </div>

      <div className="home-charts-row">
        <div className="card-elevated home-chart-card glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-2">
          <h2 className="form-section-title home-chart-title">
            Daily expence ({monthHumanLabel(chartMonth)})
          </h2>
          <p className="small muted home-chart-candle-legend mb-0">
            Candlesticks: open/close = optimized total vs previous day; wicks
            include actual order totals.
          </p>
          <div className="home-chart-inner">
            {monthOrdersLoading ? (
              <Loader variant="inline" label="Loading chart…" />
            ) : monthOrdersError ? (
              <p className="muted mb-0 home-chart-empty" role="alert">
                {monthOrdersError}
              </p>
            ) : stats.orderCount === 0 ? (
              <p className="muted mb-0 home-chart-empty">
                No orders in {monthHumanLabel(chartMonth)}.
              </p>
            ) : (
              <DailyExpenseCandlestick
                data={dailyCandlestickData}
                chartColors={chartColors}
                formatDateLabel={formatDateDDMMYYYY}
              />
            )}
          </div>
        </div>

        <div className="card-elevated home-chart-card glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-2">
          <h2 className="form-section-title home-chart-title">
            Top users ({monthHumanLabel(chartMonth)})
          </h2>
          <div className="home-chart-inner">
            {monthOrdersLoading ? (
              <Loader variant="inline" label="Loading chart…" />
            ) : monthOrdersError ? (
              <p className="muted mb-0 home-chart-empty" role="alert">
                {monthOrdersError}
              </p>
            ) : topCustomersWithNames.length === 0 ? (
              <p className="muted mb-0 home-chart-empty">
                No orders in {monthHumanLabel(chartMonth)}.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  layout="vertical"
                  data={topCustomersWithNames}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartColors.grid}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={88}
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-h)",
                    }}
                    formatter={(value) => [`₹${value}`, "Expence"]}
                  />
                  <Bar
                    dataKey="amount"
                    fill={chartColors.accent}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="home-charts-row">
        <div className="card-elevated home-chart-card home-chart-card--span2 glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-3">
          <h2 className="form-section-title home-chart-title">
            Optimized total vs current total ({monthHumanLabel(chartMonth)})
          </h2>
          <div className="home-chart-inner">
            {monthOrdersLoading ? (
              <Loader variant="inline" label="Loading chart…" />
            ) : monthOrdersError ? (
              <p className="muted mb-0 home-chart-empty" role="alert">
                {monthOrdersError}
              </p>
            ) : stats.orderCount === 0 ? (
              <p className="muted mb-0 home-chart-empty">
                No orders in {monthHumanLabel(chartMonth)}.
              </p>
            ) : (
              <>
                <p className="small muted mb-2 home-chart-range-totals">
                  Current total in this range: ₹{stats.totalAmount}
                  <br />
                  Optimized total in this range: ₹{optimizedMonthTotal}
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={dailyOptimizationChart}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: chartColors.text, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.border }}
                    />
                    <YAxis
                      tick={{ fill: chartColors.text, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.border }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-elevated)",
                        border: `1px solid ${chartColors.border}`,
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-h)",
                      }}
                      formatter={(value, name) => [
                        `₹${value}`,
                        name === "currentTotal"
                          ? "Current total"
                          : "Optimized total",
                      ]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.dateKey
                          ? formatDateDDMMYYYY(payload[0].payload.dateKey)
                          : ""
                      }
                    />
                    <Bar
                      dataKey="currentTotal"
                      fill="color-mix(in srgb, var(--accent) 55%, #ffffff)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="optimizedTotal"
                      fill={chartColors.accent}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="home-charts-row">
        <div className="card-elevated home-chart-card home-chart-card--span2 glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-3">
          <h2 className="form-section-title home-chart-title">
            HouseKeeper totalAmount ({selectedYear})
          </h2>
          <div className="home-chart-inner">
            {hkYearLoading ? (
              <Loader variant="inline" label="Loading chart…" />
            ) : hkYearError ? (
              <p className="muted mb-0 home-chart-empty" role="alert">
                {hkYearError}
              </p>
            ) : housekeeperMonthlyChartData.length === 0 ? (
              <p className="muted mb-0 home-chart-empty">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={housekeeperMonthlyChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartColors.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                  />
                  <YAxis
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-h)",
                    }}
                    formatter={(value) => [`₹${value}`, "Total amount"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.monthKey || ""}
                  />
                  <Bar
                    dataKey="amount"
                    fill={chartColors.accent}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="home-charts-row">
          <div className="card-elevated home-chart-card home-chart-card--span2 glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-3">
          <h2 className="form-section-title home-chart-title">
            Light bill ({selectedYear})
          </h2>
          <div className="home-chart-inner">
            {lightLoading ? (
              <Loader variant="inline" label="Loading light bills…" />
            ) : lightError ? (
              <p className="muted mb-0 home-chart-empty" role="alert">
                {lightError}
              </p>
            ) : lightBillPeriodChartData.length === 0 ? (
              <p className="muted mb-0 home-chart-empty">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={lightBillPeriodChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartColors.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.border }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elevated)",
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-h)",
                    }}
                    formatter={(value) => [`₹${value}`, "Light bill"]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload;
                      if (!p?.rangeLabel) return "";
                      return `${p.periodLabel} (${p.rangeLabel})`;
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    fill={chartColors.accent}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="small muted mb-0 mt-2">
              <Link to="/light-bill" className="home-section-link">
                Enter or edit amounts →
              </Link>
            </p>
          </div>
        </div>
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <h2 className="form-section-title mb-0">Recent orders</h2>
          <Link to="/history" className="small muted home-section-link">
            Full history →
          </Link>
        </div>
        {recentLoading ? (
          <div className="card-elevated home-recent-loading glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-3">
            <Loader variant="inline" label="Loading recent orders…" />
          </div>
        ) : recentError ? (
          <div className="card-elevated banner banner--error glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-3" role="alert">
            {recentError}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="card-elevated glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-3">
            <p className="muted mb-0">No orders in the last 120 days.</p>
          </div>
        ) : (
          <ul className="home-recent-list">
            {recentOrders.map((row) => {
              const name = row.user?.name || "User";
              const uid = String(row.userId ?? "");
              return (
                <li key={String(row._id ?? `${uid}-${row.dateKey}`)}>
                  <div className="home-recent-main">
                    <strong>{name}</strong>
                    <span className="muted small">
                      {formatDateDDMMYYYY(row.dateKey)}
                    </span>
                  </div>
                  <div className="home-recent-meta">
                    <span className="home-recent-amount">₹{row.totalAmount}</span>
                    <Link
                      to={`/order?userId=${encodeURIComponent(uid)}&date=${encodeURIComponent(row.dateKey)}`}
                      className="btn btn-sm btn-ghost"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* <section className="home-section">
        <div className="home-section-head">
          <h2 className="form-section-title mb-0">Users</h2>
          <Link to="/users" className="small muted home-section-link">
            Manage →
          </Link>
        </div>
        {users.length === 0 ? (
          <div className="card-elevated">
            <p className="muted mb-0">
              No users yet.{" "}
              <Link to="/users/new">Add your first user</Link>.
            </p>
          </div>
        ) : (
          <ul className="user-list home-user-list">
            {users.map((u) => {
              const uid = String(u._id);
              const s = stats.byUser.get(uid);
              const badge =
                s && (s.count > 0 || s.amount > 0)
                  ? `${periodBadgePrefix}: ${s.count} order${s.count === 1 ? "" : "s"} · ₹${s.amount}`
                  : `${periodBadgePrefix}: no orders`;
              return (
                <li key={u._id} className="user-card">
                  <div className="user-meta">
                    <strong>{u.name}</strong>
                    <span className="muted">{u.phone}</span>
                    {u.address ? (
                      <span className="small">{u.address}</span>
                    ) : null}
                    <span className="small muted home-user-badge">{badge}</span>
                  </div>
                  <Link
                    to={`/order?userId=${encodeURIComponent(u._id)}`}
                    className="btn primary btn-sm"
                  >
                    New order
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section> */}
    </div>
  );
}
