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
import Loader from "../components/Loader.jsx";
import { getOrdersHistory, getUsers } from "../api";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";
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
    text: "#a8a29e",
    textHeading: "#fafaf9",
    border: "#44403c",
    grid: "#44403c",
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
  const [chartMonth, setChartMonth] = useState(currentMonthValue);
  const [users, setUsers] = useState([]);
  const [monthOrders, setMonthOrders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => monthToDateRange(chartMonth), [chartMonth]);
  const today = useMemo(() => todayISO(), []);
  const lookbackFrom = useMemo(() => lookbackFromISO(120), []);

  const stats = useMemo(
    () => aggregateMonthOrders(monthOrders, range.from, range.to),
    [monthOrders, range.from, range.to]
  );

  // const periodBadgePrefix =
  //   chartMonth === currentMonthValue() ? "This month" : monthHumanLabel(chartMonth);

  const topCustomersWithNames = useMemo(() => {
    const map = new Map(users.map((u) => [String(u._id), u.name]));
    return stats.topCustomers.map((c) => ({
      ...c,
      name: map.get(c.userId) || "User",
      label: (map.get(c.userId) || "User").slice(0, 18),
    }));
  }, [stats.topCustomers, users]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      Promise.all([
        getUsers(),
        getOrdersHistory({ from: range.from, to: range.to }),
        getOrdersHistory({ from: lookbackFrom, to: today }),
      ])
        .then(([userList, monthRows, recentRows]) => {
          if (cancelled) return;
          setError(null);
          setUsers(Array.isArray(userList) ? userList : []);
          setMonthOrders(Array.isArray(monthRows) ? monthRows : []);
          const sorted = Array.isArray(recentRows) ? recentRows : [];
          setRecentOrders(sorted.slice(0, 4));
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setUsers([]);
            setMonthOrders([]);
            setRecentOrders([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, lookbackFrom, today]);

  const monthLabelShort = `${chartMonth.slice(5, 7)}/${chartMonth.slice(0, 4)}`;
  const rangeDisplay = `${formatDateDDMMYYYY(range.from)} – ${formatDateDDMMYYYY(range.to)}`;

  if (loading) {
    return (
      <div className="page page--wide home-dashboard">
        <div className="loading-block">
          <Loader label="Loading dashboard…" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page--wide home-dashboard">
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide home-dashboard">
      <div className="page-head home-dashboard-head">
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

      <div className="card-elevated invoice-toolbar home-month-toolbar">
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
        <div className="card-elevated home-stat-card">
          <p className="home-stat-label muted mb-0">Orders</p>
          <p className="home-stat-sublabel muted small mb-0">
            {monthHumanLabel(chartMonth)}
          </p>
          <p className="home-stat-value">{stats.orderCount}</p>
        </div>
        <div className="card-elevated home-stat-card home-stat-card--accent">
          <p className="home-stat-label mb-0">Expence</p>
          <p className="home-stat-sublabel muted small mb-0">
            {monthHumanLabel(chartMonth)}
          </p>
          <p className="home-stat-value">₹{stats.totalAmount}</p>
        </div>
        <div className="card-elevated home-stat-card">
          <p className="home-stat-label muted mb-0">Users</p>
          <p className="home-stat-value">{users.length}</p>
        </div>
      </div>

      <div className="home-charts-row">
        <div className="card-elevated home-chart-card">
          <h2 className="form-section-title home-chart-title">
            Daily expence ({monthHumanLabel(chartMonth)})
          </h2>
          <div className="home-chart-inner">
            {stats.orderCount === 0 ? (
              <p className="muted mb-0 home-chart-empty">
                No orders in {monthHumanLabel(chartMonth)}.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stats.dailyChart}
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
                    formatter={(value) => [`₹${value}`, "Expence"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.dateKey
                        ? formatDateDDMMYYYY(payload[0].payload.dateKey)
                        : ""
                    }
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

        <div className="card-elevated home-chart-card">
          <h2 className="form-section-title home-chart-title">
            Top users ({monthHumanLabel(chartMonth)})
          </h2>
          <div className="home-chart-inner">
            {topCustomersWithNames.length === 0 ? (
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

      <section className="home-section">
        <div className="home-section-head">
          <h2 className="form-section-title mb-0">Recent orders</h2>
          <Link to="/history" className="small muted home-section-link">
            Full history →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="card-elevated">
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
