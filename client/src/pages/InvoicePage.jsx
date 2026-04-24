import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { getOrdersHistory, getUsers } from "../api";
import { formatThaliQuantities } from "../utils/thaliFormat.js";
import { formatDateDDMMYYYY, formatDateTimeIST } from "../utils/dateFormat.js";
import { aggregateHistorySummary, formatThaliSummaryLine } from "../utils/aggregateHistorySummary.js";
import { computeEqualSplitByDay } from "../utils/dailyOptimization.js";

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
    const d = new Date();
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
    const last = new Date(yy, mm, 0).getDate();
    const to = `${yy}-${String(mm).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    return { from, to };
  }
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export default function InvoicePage({ authUser }) {
  const [month, setMonth] = useState(currentMonthValue);
  const [filterUserId, setFilterUserId] = useState(() => String(authUser?._id || ""));
  const [didInitFilterFromAuth, setDidInitFilterFromAuth] = useState(() =>
    Boolean(authUser?._id)
  );
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descriptionModal, setDescriptionModal] = useState(null);

  const { from, to } = useMemo(() => monthToDateRange(month), [month]);

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (didInitFilterFromAuth || !authUser?._id) return;
    setFilterUserId(String(authUser._id));
    setDidInitFilterFromAuth(true);
  }, [authUser?._id, didInitFilterFromAuth]);

  useEffect(() => {
    let cancelled = false;
  
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
  
        const data = await getOrdersHistory({
          from,
          to,
        });
  
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
  
    fetchData();
  
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    if (!descriptionModal) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setDescriptionModal(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [descriptionModal]);

  const split = useMemo(() => computeEqualSplitByDay(rows), [rows]);

  function formatAggregatedExtrasForInvoice(dayRows) {
    const s = aggregateHistorySummary(dayRows);
    const parts = [];
    if (s.rotiTotal > 0) parts.push(`Roti ${s.rotiTotal}`);
    const sabjiPortions = (s.sabjiLegacyTotal || 0) + (s.sabjiNamedPortions || 0);
    if (sabjiPortions > 0) parts.push(`Sabji ${sabjiPortions}`);
    const dalUnits =
      (s.dalRiceTypeCounts?.Pulav || 0) +
      (s.dalRiceTypeCounts?.Khichdi || 0) +
      (s.dalRiceTypeCounts?.Dalrice || 0) +
      (s.dalRiceLegacyTotal || 0);
    if (dalUnits > 0) parts.push(`Dal-rice ${dalUnits}`);
    if (s.riceTotal > 0) parts.push(`Rice ${s.riceTotal}`);
    return parts.length ? parts.join(", ") : "—";
  }

  function formatAggregatedDescriptionForInvoice(dayRows) {
    const parts = dayRows
      .map((r) =>
        typeof r?.description === "string" ? r.description.trim() : ""
      )
      .filter(Boolean);
    if (!parts.length) return "—";
    return parts.join(" | ");
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.userId || "unknown";
      if (filterUserId && String(key) !== String(filterUserId)) continue;
      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          user: row.user,
          days: [],
          subtotal: 0,
          optimizedSubtotal: 0,
        });
      }
      const g = map.get(key);
      g.subtotal += Number(row.totalAmount) || 0;
    }

    // Build date-wise rows per user (one line per dateKey).
    for (const row of rows) {
      const key = row.userId || "unknown";
      if (filterUserId && String(key) !== String(filterUserId)) continue;
      if (!map.has(key)) continue;
      const g = map.get(key);
      if (!g._byDate) g._byDate = new Map();
      const dk = String(row.dateKey || "");
      if (!dk) continue;
      if (!g._byDate.has(dk)) g._byDate.set(dk, []);
      g._byDate.get(dk).push(row);
    }

    const list = [...map.values()];
    list.sort((a, b) => {
      const an = (a.user?.name || "").toLowerCase();
      const bn = (b.user?.name || "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return String(a.userId).localeCompare(String(b.userId));
    });
    for (const g of list) {
      const entries = g._byDate ? [...g._byDate.entries()] : [];
      entries.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      g.days = entries.map(([dateKey, dayRows]) => {
        const originalTotal = dayRows.reduce(
          (s, r) => s + (Number(r?.totalAmount) || 0),
          0
        );
        const share = split.userDayShare.get(String(g.userId))?.get(dateKey) || 0;
        const roundingDelta = split.dayMap.get(dateKey)?.roundingDelta || 0;
        g.optimizedSubtotal += share;
        return {
          dateKey,
          dayRows,
          originalTotal,
          optimizedShare: share,
          roundingDelta,
        };
      });
      delete g._byDate;
    }
    return list;
  }, [rows, filterUserId, split.dayMap, split.userDayShare]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
    [rows]
  );

  const displayedGrandTotal = useMemo(() => {
    if (!grouped.length) return 0;
    return grouped.reduce((s, g) => s + (Number(g.subtotal) || 0), 0);
  }, [grouped]);

  const optimizedGrandTotal = useMemo(() => {
    if (!grouped.length) return 0;
    return grouped.reduce((s, g) => s + (Number(g.optimizedSubtotal) || 0), 0);
  }, [grouped]);

  return (
    <div className="page page--wide invoice-page premium-shell premium-page">
      <div className="page-head invoice-page-head glass-hero premium-hero motion-fade-up">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Invoice</h1>
          <p className="lede muted">
            Current month by default — starts with <strong>your</strong> invoices.
            Use user filter to view anyone or all users.
          </p>
        </div>
        <Link to="/users" className="btn btn-ghost">
          Users
        </Link>
      </div>

      <div className="card-elevated invoice-toolbar glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-1">
        <label className="invoice-month-label">
          <span className="form-section-title invoice-month-title">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="invoice-month-input"
          />
        </label>
        <label className="invoice-month-label invoice-customer-label">
          <span className="form-section-title invoice-month-title">User</span>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="invoice-customer-select"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.phone})
              </option>
            ))}
          </select>
        </label>
        <p className="muted invoice-range-hint mb-0">
          Showing{" "}
          <strong>{formatDateDDMMYYYY(from)}</strong> →{" "}
          <strong>{formatDateDDMMYYYY(to)}</strong>
        </p>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-block">
          <Loader label="Loading invoice…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card-elevated glass-surface glass-panel-3d depth-card neon-edge">
          <p className="muted mb-0">
            {filterUserId
              ? "No orders for this user in this month."
              : "No orders in this month."}
          </p>
        </div>
      ) : (
        <>
          {grouped.map((g) => (
            <section key={g.userId} className="card-elevated invoice-user-block glass-surface glass-panel-3d depth-card premium-chart-card motion-lift motion-fade-up motion-delay-2">
              <div className="invoice-user-head">
                <div>
                  <h2 className="invoice-user-name">
                    {g.user?.name || "Unknown user"}
                  </h2>
                  {g.user?.phone ? (
                    <p className="muted small mb-0">{g.user.phone}</p>
                  ) : null}
                </div>
                <div className="invoice-user-subtotal">
                  <span className="muted invoice-subtotal-label">Subtotal</span>
                  <span className="invoice-subtotal-amount">₹{g.subtotal}</span>
                  <span className="muted invoice-subtotal-label">Optimized</span>
                  <span className="invoice-subtotal-amount">₹{g.optimizedSubtotal}</span>
                </div>
              </div>
              <div className="table-scroll">
                <table className="history-table invoice-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time (IST)</th>
                      <th>Thali (qty)</th>
                      <th>Extras</th>
                      <th>Description</th>
                      <th className="history-col-total">Original</th>
                      <th className="history-col-total">Optimized share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.days.map((d) => {
                      const s = aggregateHistorySummary(d.dayRows);
                      const thaliLine =
                        formatThaliSummaryLine(s.thaliCounts) ||
                        formatThaliQuantities([]);
                      const extrasLine = formatAggregatedExtrasForInvoice(d.dayRows);
                      const descriptionLine = formatAggregatedDescriptionForInvoice(
                        d.dayRows
                      );
                      const latestCreatedAt = d.dayRows.reduce((latest, r) => {
                        const ts = Date.parse(r?.createdAt || "");
                        if (!Number.isFinite(ts)) return latest;
                        if (latest == null || ts > latest) return ts;
                        return latest;
                      }, null);
                      return (
                        <tr key={`${g.userId}-${d.dateKey}`}>
                          <td>
                            <strong>
                              {latestCreatedAt != null
                                ? formatDateTimeIST(new Date(latestCreatedAt))
                                : formatDateDDMMYYYY(d.dateKey)}
                            </strong>
                          </td>
                          <td className="history-cell-mono">{thaliLine || "—"}</td>
                          <td className="history-cell-extras">{extrasLine}</td>
                          <td>
                            {descriptionLine !== "—" ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost history-desc-btn"
                                aria-label="Show description"
                                title="Show description"
                                onClick={() => {
                                  setDescriptionModal({
                                    dateKey: d.dateKey,
                                    createdAt:
                                      latestCreatedAt != null
                                        ? new Date(latestCreatedAt)
                                        : null,
                                    userName: g.user?.name || "User",
                                    userPhone: g.user?.phone || "",
                                    description: descriptionLine,
                                  });
                                }}
                              >
                                <span className="history-desc-icon" aria-hidden="true">
                                  i
                                </span>
                              </button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="history-col-total">
                            <strong>₹{d.originalTotal}</strong>
                          </td>
                          <td className="history-col-total">
                            <strong>₹{d.optimizedShare}</strong>
                            {d.roundingDelta ? (
                              <div className="small muted">
                                Δ {d.roundingDelta > 0 ? "+" : ""}
                                {d.roundingDelta}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <div className="card-elevated invoice-grand-total glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-2">
            <span className="invoice-grand-label">
              {filterUserId ? "Total (filtered)" : "Grand total (month)"}
            </span>
            <span className="invoice-grand-amount">
              ₹{filterUserId ? displayedGrandTotal : grandTotal}
            </span>
            <span className="invoice-grand-label">Optimized total (split)</span>
            <span className="invoice-grand-amount">₹{optimizedGrandTotal}</span>
          </div>
        </>
      )}
      {descriptionModal ? (
        <div
          className="history-desc-modal-backdrop"
          role="presentation"
          onClick={() => setDescriptionModal(null)}
        >
          <div
            className="history-desc-modal card-elevated glass-surface glass-panel-3d depth-card neon-edge"
            role="dialog"
            aria-modal="true"
            aria-label="Order description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="history-desc-modal-head">
              <div className="history-desc-modal-meta">
                <p className="eyebrow mb-0">Order Note</p>
                <h3 className="form-section-title mb-0">Description</h3>
                <p className="small muted mb-0 history-desc-modal-sub">
                  {descriptionModal.userName}
                  {descriptionModal.userPhone
                    ? ` (${descriptionModal.userPhone})`
                    : ""}{" "}
                  · {formatDateDDMMYYYY(descriptionModal.dateKey)} ·{" "}
                  {descriptionModal.createdAt
                    ? formatDateTimeIST(descriptionModal.createdAt)
                    : "—"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost history-desc-close-btn"
                onClick={() => setDescriptionModal(null)}
              >
                Close
              </button>
            </div>
            <div className="history-desc-modal-body-wrap">
              <p className="history-desc-modal-body mb-0">
                {descriptionModal.description}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
