import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { getOrdersHistory, getUsers } from "../api";
import { formatThaliQuantities } from "../utils/thaliFormat.js";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";
import { formatOrderExtras } from "../utils/formatOrderExtras.js";
import {
  aggregateHistorySummary,
  formatThaliSummaryLine,
} from "../utils/aggregateHistorySummary.js";
import {
  EXTRA_PRICES,
  formatOptimizedThaliLine,
  optimizeExtrasForRange,
} from "../utils/optimizeExtrasBundles.js";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getOrdersHistory({
          from: dateFrom,
          to: dateTo,
          userId: filterUserId || undefined,
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
  }, [dateFrom, dateTo, filterUserId]);

  const summary = useMemo(() => aggregateHistorySummary(rows), [rows]);
  const optimize = useMemo(
    () => optimizeExtrasForRange(summary, { includeOrderedThalis: true }),
    [summary]
  );

  const hasThaliTotals = summary.thaliCounts.size > 0;
  const hasDalType =
    summary.dalRiceTypeCounts.Pulav > 0 ||
    summary.dalRiceTypeCounts.Khichdi > 0 ||
    summary.dalRiceTypeCounts.Dalrice > 0;
  const hasExtrasBreakdown =
    summary.rotiTotal > 0 ||
    summary.riceTotal > 0 ||
    summary.sabjiLegacyTotal > 0 ||
    summary.sabjiNamedPortions > 0 ||
    summary.sabjiNameCounts.length > 0 ||
    hasDalType ||
    summary.dalRiceLegacyTotal > 0;

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
          <Loader label="Loading orders…" />
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
                        {formatOrderExtras(row.extraItems)}
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

      {!loading && rows.length > 0 ? (
        <div className="card-elevated history-summary">
          <h2 className="form-section-title history-summary-title">
            Summary for this range
          </h2>
          {filterUserId ? (
            <p className="muted small history-summary-sub mb-0">
              Filtered to one user.
            </p>
          ) : null}

          <div className="history-summary-grid">
            <div className="history-summary-col">
              {hasThaliTotals ? (
                <section className="history-summary-section">
                  <h3 className="history-summary-heading">Thalis (plates)</h3>
                  <p className="history-summary-value mb-0">
                    {formatThaliSummaryLine(summary.thaliCounts)}
                  </p>
                </section>
              ) : null}

              <section className="history-summary-section">
                <h3 className="history-summary-heading">Extras</h3>
                {!hasExtrasBreakdown ? (
                  <p className="muted mb-0">No extras in this range.</p>
                ) : (
                  <dl className="history-summary-dl">
                    {summary.rotiTotal > 0 ? (
                      <>
                        <dt>Roti</dt>
                        <dd>{summary.rotiTotal}</dd>
                      </>
                    ) : null}
                    {summary.riceTotal > 0 ? (
                      <>
                        <dt>Rice</dt>
                        <dd>{summary.riceTotal}</dd>
                      </>
                    ) : null}
                    {summary.sabjiLegacyTotal > 0 ? (
                      <>
                        <dt>Sabji (legacy qty)</dt>
                        <dd>{summary.sabjiLegacyTotal}</dd>
                      </>
                    ) : null}
                    {summary.sabjiNameCounts.length > 0 ? (
                      <>
                        <dt>Sabji (named)</dt>
                        <dd>
                          <ul className="history-summary-sabji-list mb-0">
                            {summary.sabjiNameCounts.map(({ name, count }) => (
                              <li key={name}>
                                <span className="history-summary-name">
                                  {name}
                                </span>
                                <span className="muted"> × {count}</span>
                              </li>
                            ))}
                          </ul>
                          <span className="small muted">
                            {summary.sabjiNamedPortions} portion
                            {summary.sabjiNamedPortions === 1 ? "" : "s"}{" "}
                            total
                          </span>
                        </dd>
                      </>
                    ) : null}
                    {summary.dalRiceTypeCounts.Pulav > 0 ? (
                      <>
                        <dt>Pulav (orders)</dt>
                        <dd>{summary.dalRiceTypeCounts.Pulav}</dd>
                      </>
                    ) : null}
                    {summary.dalRiceTypeCounts.Khichdi > 0 ? (
                      <>
                        <dt>Khichdi (orders)</dt>
                        <dd>{summary.dalRiceTypeCounts.Khichdi}</dd>
                      </>
                    ) : null}
                    {summary.dalRiceTypeCounts.Dalrice > 0 ? (
                      <>
                        <dt>Dalrice (orders)</dt>
                        <dd>{summary.dalRiceTypeCounts.Dalrice}</dd>
                      </>
                    ) : null}
                    {summary.dalRiceLegacyTotal > 0 ? (
                      <>
                        <dt>Dal rice (legacy qty)</dt>
                        <dd>{summary.dalRiceLegacyTotal}</dd>
                      </>
                    ) : null}
                  </dl>
                )}
              </section>
            </div>

            <aside
              className="history-summary-col history-summary-optimize"
              aria-label="Cost-optimized bundle hint"
            >
              <h3 className="history-summary-heading">
                Lowest-cost way to cover what was ordered
              </h3>
              <p className="small muted history-summary-optimize-lede">
                Re-optimizes the total quantities implied by ordered thalis +
                extras (roti/sabji/dal-rice), plus rice at ₹{EXTRA_PRICES.rice} each.
              </p>
              {!optimize.hasDemand ? (
                <p className="muted mb-0">Nothing to optimize in this range.</p>
              ) : optimize.skippedOptimizer ? (
                <div className="history-summary-optimize-body">
                  {optimize.note ? (
                    <p className="small muted mb-0">{optimize.note}</p>
                  ) : null}
                  <p className="mb-0">
                    <strong>Current total:</strong> ₹{optimize.currentPaidCost}
                  </p>
                </div>
              ) : (
                <div className="history-summary-optimize-body">
                  {optimize.note ? (
                    <p className="small muted">{optimize.note}</p>
                  ) : null}
                  {formatOptimizedThaliLine(optimize.thaliCounts) ? (
                    <>
                      <p className="history-summary-value mb-0">
                        <strong>Thalis:</strong>{" "}
                        {formatOptimizedThaliLine(optimize.thaliCounts)}
                      </p>
                      {optimize.thaliOnlyCost > 0 ? (
                        <p className="small muted mb-0">
                          Thali bundles subtotal: ₹{optimize.thaliOnlyCost}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {(optimize.leftoverRoti > 0 ||
                    optimize.leftoverSabji > 0 ||
                    optimize.leftoverDal > 0) && (
                    <ul className="history-summary-optimize-list">
                      {optimize.leftoverRoti > 0 ? (
                        <li>
                          <strong>
                            Extra roti x {optimize.leftoverRoti} (₹
                            {optimize.leftoverRoti * EXTRA_PRICES.roti})
                          </strong>
                        </li>
                      ) : null}
                      {optimize.leftoverSabji > 0 ? (
                        <li>
                          <strong>
                            Extra sabji x {optimize.leftoverSabji} (₹
                            {optimize.leftoverSabji * EXTRA_PRICES.sabji})
                          </strong>
                        </li>
                      ) : null}
                      {optimize.leftoverDal > 0 ? (
                        <li>
                          <strong>
                            Extra dal-rice x {optimize.leftoverDal} (₹
                            {optimize.leftoverDal * EXTRA_PRICES.dalRice})
                          </strong>
                        </li>
                      ) : null}
                    </ul>
                  )}
                  {optimize.riceCost > 0 ? (
                    <p className="mb-0">
                      <strong>
                        Rice: {summary.riceTotal} x ₹{EXTRA_PRICES.rice} = ₹
                        {optimize.riceCost}
                      </strong>
                    </p>
                  ) : null}
                  <p className="history-summary-optimize-total mb-0">
                    <strong>Optimized total:</strong> ₹{optimize.totalOptimized}
                  </p>
                  <p className="small muted mb-0">
                    Current total in this range: ₹{optimize.currentPaidCost}
                  </p>
                  {optimize.savingsVsCurrent > 0 ? (
                    <p className="history-summary-savings mb-0">
                      Saves ₹{optimize.savingsVsCurrent}
                    </p>
                  ) : null}
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
