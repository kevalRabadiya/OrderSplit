import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrdersHistory, getUsers } from "../api";
import { formatThaliQuantities } from "../utils/thaliFormat.js";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatExtras(e) {
  if (!e) return "—";
  const parts = [];
  if (e.roti) parts.push(`Roti ${e.roti}`);
  if (e.sabji) parts.push(`Sabji ${e.sabji}`);
  if (e.dalRice) parts.push(`Dal ${e.dalRice}`);
  if (e.rice) parts.push(`Rice ${e.rice}`);
  return parts.length ? parts.join(", ") : "—";
}

export default function HistoryPage() {
  const [dateFrom, setDateFrom] = useState(() => todayISO());
  const [dateTo, setDateTo] = useState(() => todayISO());
  const [filterUserId, setFilterUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    let cancelled = false;
    getOrdersHistory({
      from: dateFrom,
      to: dateTo,
      userId: filterUserId || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setError(null);
          setRows(Array.isArray(data) ? data : []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, filterUserId]);

  function clearFilters() {
    const t = todayISO();
    setDateFrom(t);
    setDateTo(t);
    setFilterUserId("");
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>History</h1>
          <p className="lede muted">
            Defaults to today for everyone. Narrow by date range or one
            user. <strong>Clear filters</strong> resets to today and all
            users.
          </p>
        </div>
        <Link to="/users" className="btn btn-ghost">
          Users
        </Link>
      </div>

      <div className="card-elevated history-filters">
        <div className="history-filters-head">
          <h2 className="form-section-title history-filters-title">Filters</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
        <div className="history-filter-grid">
          <label>
            From
            <input
              className="history-filter-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="small muted">{formatDateDDMMYYYY(dateFrom)}</span>
          </label>
          <label>
            To
            <input
              className="history-filter-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <span className="small muted">{formatDateDDMMYYYY(dateTo)}</span>
          </label>
          <label className="history-filter-user">
            User
            <select
              className="history-filter-select"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.phone})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-block">
          <div className="loading-skeleton" aria-hidden="true" />
          <p className="muted mt-load">Loading orders…</p>
        </div>
      ) : (
        <div className="card-elevated history-table-wrap">
          {rows.length === 0 ? (
            <p className="muted mb-0">No orders in this range.</p>
          ) : (
            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Thali (qty)</th>
                    <th>Extras</th>
                    <th className="history-col-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={
                        row._id != null
                          ? String(row._id)
                          : `${row.userId}-${row.dateKey}`
                      }
                    >
                      <td>{formatDateDDMMYYYY(row.dateKey)}</td>
                      <td>
                        {row.user ? (
                          <>
                            <strong>{row.user.name}</strong>
                            <br />
                            <span className="small muted">
                              {row.user.phone}
                            </span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="history-cell-mono">
                        {formatThaliQuantities(row.thaliIds)}
                      </td>
                      <td className="history-cell-extras">
                        {formatExtras(row.extraItems)}
                      </td>
                      <td className="history-col-total">
                        <strong>₹{row.totalAmount}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
