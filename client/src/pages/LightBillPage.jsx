import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLightBillsForYear, saveLightBillPeriod } from "../api";
import Loader from "../components/Loader.jsx";

function defaultFromToMonth() {
  const d = new Date();
  const curY = d.getFullYear();
  const curM = d.getMonth() + 1;
  const to = `${curY}-${String(curM).padStart(2, "0")}`;
  const prev = new Date(curY, curM - 2, 1);
  const from = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return { fromMonthKey: from, toMonthKey: to };
}

function monthHumanLabel(ym) {
  const [ys, ms] = String(ym).split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return ym;
  }
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function mergeBillRows(rowsA, rowsB) {
  const map = new Map();
  for (const r of [...(rowsA || []), ...(rowsB || [])]) {
    if (!r?.fromMonthKey || !r?.toMonthKey) continue;
    const k = `${r.fromMonthKey}|${r.toMonthKey}`;
    map.set(k, r);
  }
  return [...map.values()];
}

export default function LightBillPage() {
  const [fromMonthKey, setFromMonthKey] = useState(
    () => defaultFromToMonth().fromMonthKey
  );
  const [toMonthKey, setToMonthKey] = useState(
    () => defaultFromToMonth().toMonthKey
  );
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveOk(false);

    const y1 = Number(fromMonthKey.slice(0, 4));
    const y2 = Number(toMonthKey.slice(0, 4));

    const p1 = getLightBillsForYear(y1);
    const p2 = y2 !== y1 ? getLightBillsForYear(y2) : Promise.resolve([]);

    Promise.all([p1, p2])
      .then(([rows1, rows2]) => {
        if (cancelled) return;
        const merged = mergeBillRows(
          Array.isArray(rows1) ? rows1 : [],
          Array.isArray(rows2) ? rows2 : []
        );
        const row = merged.find(
          (r) =>
            r.fromMonthKey === fromMonthKey && r.toMonthKey === toMonthKey
        );
        const v =
          row != null && Number.isFinite(Number(row.amount)) ? row.amount : "";
        setAmount(v === "" ? "" : String(v));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || "Failed to load light bill.");
          setAmount("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromMonthKey, toMonthKey]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaveOk(false);
    if (fromMonthKey > toMonthKey) {
      setError("From month must be on or before to month.");
      return;
    }
    if (String(amount).trim() === "") {
      setError("Enter an amount.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    setSaving(true);
    try {
      await saveLightBillPeriod({ fromMonthKey, toMonthKey, amount: n });
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div>
          <p className="eyebrow">Utilities</p>
          <h1>Light bill</h1>
          <p className="lede muted mb-0">
            Enter the amount for a <strong>billing period</strong> (e.g. Jan–Feb).
            The home chart shows one bar per period with the full amount.
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">
          Home
        </Link>
      </div>

      {loading ? (
        <div className="loading-block">
          <Loader label="Loading…" />
        </div>
      ) : (
        <form className="form card-elevated" onSubmit={onSubmit}>
          <h2 className="form-section-title mb-0">Billing period</h2>
          <p className="small muted mb-0">
            {monthHumanLabel(fromMonthKey)} – {monthHumanLabel(toMonthKey)}
          </p>
          <div className="light-bill-period-grid">
            <label>
              <span className="light-bill-field-hint muted">From</span>
              <input
                type="month"
                value={fromMonthKey}
                onChange={(e) => setFromMonthKey(e.target.value)}
              />
            </label>
            <label>
              <span className="light-bill-field-hint muted">To</span>
              <input
                type="month"
                value={toMonthKey}
                onChange={(e) => setToMonthKey(e.target.value)}
              />
            </label>
          </div>
          <label>
            Amount (₹)
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </label>
          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}
          {saveOk ? (
            <p className="small muted mb-0" role="status">
              Saved.
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
