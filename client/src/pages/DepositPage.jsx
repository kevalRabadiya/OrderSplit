import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { getDeposit, getUsers, saveDeposit } from "../api";
import { toast } from "../lib/toast.js";

const PIE_COLORS = [
  "#fb923c",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#f59e0b",
  "#60a5fa",
  "#c084fc",
];

function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function DepositPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [allocByUser, setAllocByUser] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [userList, deposit] = await Promise.all([getUsers(), getDeposit()]);
        if (cancelled) return;
        const safeUsers = Array.isArray(userList) ? userList : [];
        setUsers(safeUsers);
        const t = Number(deposit?.totalAmount);
        const total = Number.isFinite(t) ? t : 0;
        setTotalAmount(String(total));

        const rawAlloc = Array.isArray(deposit?.allocations) ? deposit.allocations : [];
        const next = {};
        for (const row of rawAlloc) {
          const uid = String(row?.userId ?? "");
          if (!uid) continue;
          next[uid] = round2(toNumberOrZero(row?.amount));
        }
        setAllocByUser(next);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load deposit data.");
          setUsers([]);
          setTotalAmount("0");
          setAllocByUser({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalValue = useMemo(() => Math.max(0, toNumberOrZero(totalAmount)), [totalAmount]);

  const rows = useMemo(() => {
    return users.map((u) => {
      const uid = String(u._id);
      const amount = round2(Math.max(0, toNumberOrZero(allocByUser[uid])));
      const percent = totalValue > 0 ? round2((amount / totalValue) * 100) : 0;
      return {
        userId: uid,
        name: u.name || "User",
        phone: u.phone || "",
        amount,
        percent,
      };
    });
  }, [allocByUser, totalValue, users]);

  const allocatedTotal = useMemo(
    () => round2(rows.reduce((s, r) => s + r.amount, 0)),
    [rows]
  );
  const remaining = round2(Math.max(0, totalValue - allocatedTotal));
  const overAllocated = allocatedTotal > totalValue + 0.0001;

  const pendingUsers = useMemo(() => rows.filter((r) => r.amount <= 0), [rows]);

  const pieData = useMemo(
    () =>
      rows
        .filter((r) => r.amount > 0)
        .map((r) => ({
          name: r.name,
          value: r.amount,
          percent: r.percent,
        })),
    [rows]
  );

  function handleAmountChange(userId, raw) {
    const cleaned = raw === "" ? "" : raw;
    const n = cleaned === "" ? 0 : Math.max(0, toNumberOrZero(cleaned));
    setAllocByUser((prev) => ({ ...prev, [userId]: round2(n) }));
  }

  function handlePercentChange(userId, rawPercent) {
    const p = Math.max(0, Math.min(100, toNumberOrZero(rawPercent)));
    const amount = totalValue > 0 ? round2((totalValue * p) / 100) : 0;
    setAllocByUser((prev) => ({ ...prev, [userId]: amount }));
  }

  function handleTotalChange(raw) {
    const n = raw === "" ? "" : Math.max(0, toNumberOrZero(raw));
    setTotalAmount(String(n));
  }

  async function onSave(e) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(totalValue) || totalValue < 0) {
      setError("Enter a valid total amount.");
      return;
    }
    if (overAllocated) {
      setError("Allocated amount cannot exceed total amount.");
      return;
    }

    const allocations = rows
      .filter((r) => r.amount > 0)
      .map((r) => ({ userId: r.userId, amount: round2(r.amount) }));
    const sumBefore = round2(allocations.reduce((s, a) => s + a.amount, 0));
    const drift = round2(totalValue - sumBefore);
    // Reconcile tiny rounding drift into the last row.
    if (allocations.length > 0 && Math.abs(drift) > 0 && Math.abs(drift) <= 0.05) {
      const last = allocations[allocations.length - 1];
      last.amount = round2(Math.max(0, last.amount + drift));
    }

    setSaving(true);
    try {
      await saveDeposit({
        totalAmount: round2(totalValue),
        allocations,
      });
      toast.success("Deposit saved.");
    } catch (e2) {
      const msg = e2.message || "Could not save deposit.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page--wide deposit-page premium-shell premium-page">
      <div className="page-head deposit-page-head glass-hero premium-hero motion-fade-up">
        <div>
          <p className="eyebrow">Utilities</p>
          <h1>Deposit</h1>
          <p className="lede muted mb-0">
            Manage current deposit pool, split by user, and track pending users.
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">
          Home
        </Link>
      </div>

      {loading ? (
        <div className="loading-block">
          <Loader label="Loading deposit data…" />
        </div>
      ) : (
        <>
          <form
            className="form card-elevated deposit-form glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-1"
            onSubmit={onSave}
          >
            <h2 className="form-section-title mb-0">Current deposit pool</h2>
            <label>
              Total amount (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => handleTotalChange(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </label>

            <div className="deposit-summary-grid">
              <div className="deposit-summary-item">
                <span className="small muted">Allocated</span>
                <strong>₹{allocatedTotal.toFixed(2)}</strong>
              </div>
              <div className="deposit-summary-item">
                <span className="small muted">Remaining</span>
                <strong>₹{remaining.toFixed(2)}</strong>
              </div>
              <div className="deposit-summary-item">
                <span className="small muted">Pending users</span>
                <strong>{pendingUsers.length}</strong>
              </div>
            </div>

            {error ? (
              <div className="banner banner--error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>

          <section className="card-elevated deposit-split-wrap glass-surface glass-panel-3d depth-card premium-chart-card motion-fade-up motion-delay-2">
            <div className="deposit-split-head">
              <h2 className="form-section-title mb-0">User split</h2>
              <span className="small muted">
                Edit amount or percentage (both stay in sync)
              </span>
            </div>
            <div className="table-scroll">
              <table className="history-table deposit-split-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Phone</th>
                    <th>Amount (₹)</th>
                    <th>Percentage (%)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td className="small muted">{r.phone || "—"}</td>
                      <td>
                        <input
                          className="deposit-cell-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number.isFinite(r.amount) ? String(r.amount) : "0"}
                          onChange={(e) => handleAmountChange(r.userId, e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="deposit-cell-input"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={Number.isFinite(r.percent) ? String(r.percent) : "0"}
                          onChange={(e) => handlePercentChange(r.userId, e.target.value)}
                        />
                      </td>
                      <td>
                        {r.amount > 0 ? (
                          <span className="deposit-chip deposit-chip--paid">Paid</span>
                        ) : (
                          <span className="deposit-chip deposit-chip--pending">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="deposit-analytics-grid">
            <section className="card-elevated deposit-pending-card glass-surface glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-3">
              <h2 className="form-section-title mb-0">Pending users (all users)</h2>
              <ul className="deposit-pending-list">
                {rows.map((u) => (
                  <li key={u.userId}>
                    <div className="deposit-pending-user">
                      <strong>{u.name}</strong>
                      <span className="small muted">{u.phone || "—"}</span>
                    </div>
                    {u.amount > 0 ? (
                      <span className="deposit-chip deposit-chip--paid">Paid</span>
                    ) : (
                      <span className="deposit-chip deposit-chip--pending">Pending</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card-elevated deposit-pie-card glass-surface glass-panel-3d depth-card premium-chart-card motion-fade-up motion-delay-3">
              <h2 className="form-section-title mb-0">Deposit split chart</h2>
              {pieData.length === 0 ? (
                <p className="muted mb-0">No paid allocation to visualize yet.</p>
              ) : (
                <div className="deposit-pie-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={48}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell
                            key={`${entry.name}-${idx}`}
                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, payload) => {
                          const p = payload?.payload;
                          return [`₹${value}`, `${p?.name} (${p?.percent ?? 0}%)`];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
