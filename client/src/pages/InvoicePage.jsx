import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getOrdersHistory, getUsers } from "../api";
import { formatThaliQuantities } from "../utils/thaliFormat.js";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";

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

function formatExtras(e) {
  if (!e) return "—";
  const parts = [];
  if (e.roti) parts.push(`Roti ${e.roti}`);
  if (e.sabji) parts.push(`Sabji ${e.sabji}`);
  if (e.dalRice) parts.push(`Dal ${e.dalRice}`);
  if (e.rice) parts.push(`Rice ${e.rice}`);
  return parts.length ? parts.join(", ") : "—";
}

export default function InvoicePage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [filterUserId, setFilterUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    let cancelled = false;
    getOrdersHistory({
      from,
      to,
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
  }, [from, to, filterUserId]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.userId || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          userId: key,
          user: row.user,
          orders: [],
          subtotal: 0,
        });
      }
      const g = map.get(key);
      g.orders.push(row);
      g.subtotal += Number(row.totalAmount) || 0;
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const an = (a.user?.name || "").toLowerCase();
      const bn = (b.user?.name || "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return String(a.userId).localeCompare(String(b.userId));
    });
    for (const g of list) {
      g.orders.sort((x, y) => String(y.dateKey).localeCompare(String(x.dateKey)));
    }
    return list;
  }, [rows]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
    [rows]
  );

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Invoice</h1>
          <p className="lede muted">
            Current month by default — optional <strong>user</strong> filter;
            orders grouped per user with subtotals and a grand total.
          </p>
        </div>
        <Link to="/users" className="btn btn-ghost">
          Users
        </Link>
      </div>

      <div className="card-elevated invoice-toolbar">
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
          <div className="loading-skeleton" aria-hidden="true" />
          <p className="muted mt-load">Loading invoice…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card-elevated">
          <p className="muted mb-0">
            {filterUserId
              ? "No orders for this user in this month."
              : "No orders in this month."}
          </p>
        </div>
      ) : (
        <>
          {grouped.map((g) => (
            <section key={g.userId} className="card-elevated invoice-user-block">
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
                </div>
              </div>
              <div className="table-scroll">
                <table className="history-table invoice-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Thali (qty)</th>
                      <th>Extras</th>
                      <th className="history-col-total">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.orders.map((row) => (
                      <tr key={String(row._id ?? `${row.userId}-${row.dateKey}`)}>
                        <td>{formatDateDDMMYYYY(row.dateKey)}</td>
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
            </section>
          ))}

          <div className="card-elevated invoice-grand-total">
            <span className="invoice-grand-label">
              {filterUserId ? "Total (filtered)" : "Grand total (month)"}
            </span>
            <span className="invoice-grand-amount">₹{grandTotal}</span>
          </div>
        </>
      )}
    </div>
  );
}
