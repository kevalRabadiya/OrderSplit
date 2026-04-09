import { useEffect, useMemo, useState } from "react";
import { getHousekeeperAttendance, setHousekeeperAttendance } from "../api";
import Loader from "../components/Loader.jsx";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";

function monthValueFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthToDateRange(ym) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const safeY = Number.isFinite(y) ? y : new Date().getFullYear();
  const safeM = Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${safeY}-${pad(safeM)}-01`;
  const last = new Date(safeY, safeM, 0).getDate();
  const to = `${safeY}-${pad(safeM)}-${pad(last)}`;
  return { from, to, year: safeY, month: safeM, lastDay: last };
}

function todayKey() {
  return monthToDateRange(monthValueFromDate(new Date())).to;
}

function monthLabel(ym) {
  const { year, month } = monthToDateRange(ym);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(ym, delta) {
  const { year, month } = monthToDateRange(ym);
  const d = new Date(year, month - 1 + delta, 1);
  return monthValueFromDate(d);
}

function buildCalendarCells(ym) {
  const { year, month, lastDay } = monthToDateRange(ym);
  const firstWeekDay = new Date(year, month - 1, 1).getDay(); // 0 Sun
  const cells = [];
  for (let i = 0; i < firstWeekDay; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekDay = new Date(year, month - 1, day).getDay();
    cells.push({ day, dateKey, weekDay });
  }
  return cells;
}

const RATE_PER_DAY = Number(import.meta.env.VITE_HOUSEKEEPER_RATE_PER_DAY) || 0;

export default function HousekeeperPage() {
  const [month, setMonth] = useState(() => monthValueFromDate(new Date()));
  const [presentDateKeys, setPresentDateKeys] = useState(() => new Set());
  const [savingDateKey, setSavingDateKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => monthToDateRange(month), [month]);
  const today = useMemo(() => todayKey(), []);
  const cells = useMemo(() => buildCalendarCells(month), [month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHousekeeperAttendance({ from: range.from, to: range.to })
      .then((rows) => {
        if (cancelled) return;
        const next = new Set();
        for (const r of Array.isArray(rows) ? rows : []) {
          if (r?.present && typeof r?.dateKey === "string") next.add(r.dateKey);
        }
        setPresentDateKeys(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load HouseKeeper attendance.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const attendedDays = presentDateKeys.size;
  const totalAmount = attendedDays * RATE_PER_DAY;

  async function toggleAttendance(dateKey) {
    if (dateKey > today || savingDateKey) return;
    const current = presentDateKeys.has(dateKey);
    const nextPresent = !current;

    const optimistic = new Set(presentDateKeys);
    if (nextPresent) optimistic.add(dateKey);
    else optimistic.delete(dateKey);
    setPresentDateKeys(optimistic);
    setSavingDateKey(dateKey);
    setError(null);

    try {
      await setHousekeeperAttendance(dateKey, nextPresent);
    } catch (e) {
      setPresentDateKeys(presentDateKeys);
      setError(e.message || "Failed to save attendance.");
    } finally {
      setSavingDateKey("");
    }
  }

  return (
    <div className="page page--wide housekeeper-page">
      <div className="page-head housekeeper-page-head glass-hero">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>HouseKeeper</h1>
          <p className="lede muted">
            Tap past dates to mark HouseKeeper attendance. Future dates are locked.
          </p>
        </div>
      </div>

      <div className="card-elevated housekeeper-toolbar glass-surface">
        <div className="housekeeper-month-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            Prev month
          </button>
          <strong>{monthLabel(month)}</strong>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            Next month
          </button>
        </div>
        <p className="muted small mb-0">
          Range: <strong>{formatDateDDMMYYYY(range.from)}</strong> to{" "}
          <strong>{formatDateDDMMYYYY(range.to)}</strong>
        </p>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="housekeeper-stat-grid">
        <div className="card-elevated housekeeper-stat-card glass-surface">
          <p className="home-stat-label muted mb-0">Present days</p>
          <p className="home-stat-value">{attendedDays}</p>
        </div>
        <div className="card-elevated housekeeper-stat-card housekeeper-stat-card--accent glass-surface">
          <p className="home-stat-label mb-0">Amount</p>
          <p className="home-stat-sublabel muted small mb-0">
            ₹{RATE_PER_DAY} per day
          </p>
          <p className="home-stat-value">₹{totalAmount}</p>
        </div>
      </div>

      <section className="card-elevated housekeeper-calendar-wrap glass-surface">
        <div className="housekeeper-calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        {loading ? (
          <div className="loading-block">
            <Loader label="Loading HouseKeeper calendar…" />
          </div>
        ) : (
          <div className="housekeeper-calendar-grid">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="housekeeper-day housekeeper-day--empty" />;
              }
              const isPastOrToday = cell.dateKey <= today;
              const isChecked = presentDateKeys.has(cell.dateKey);
              const isSaving = savingDateKey === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={[
                    "housekeeper-day",
                    cell.weekDay === 0 ? "housekeeper-day--sun" : "",
                    cell.weekDay === 6 ? "housekeeper-day--sat" : "",
                    isChecked ? "housekeeper-day--checked" : "",
                    isPastOrToday ? "housekeeper-day--clickable" : "housekeeper-day--future",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleAttendance(cell.dateKey)}
                  disabled={!isPastOrToday || Boolean(savingDateKey)}
                  title={cell.dateKey}
                >
                  <span className="housekeeper-day-num">{cell.day}</span>
                  <span className="housekeeper-day-mark">
                    {isSaving ? "…" : isChecked ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

