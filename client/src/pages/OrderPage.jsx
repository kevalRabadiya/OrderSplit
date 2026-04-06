import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createOrder,
  deleteOrder,
  getOrderForUser,
  getUsers,
  previewOrder,
  updateOrder,
} from "../api";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";

const LAST_USER_KEY = "tiffin_lastUserId";

function newRowId() {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random()}`;
}

const THALI_SELECT_OPTIONS = [
  { value: "1", label: "Thali 1 — ₹110" },
  { value: "2", label: "Thali 2 — ₹110" },
  { value: "3", label: "Thali 3 — ₹90" },
  { value: "4", label: "Thali 4 — ₹90" },
  { value: "5", label: "Thali 5 — ₹75" },
];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowsFromThaliIds(ids) {
  if (!ids?.length) return [];
  return ids.map((id) => ({ rowId: newRowId(), value: String(id) }));
}

function emptyThaliRows() {
  return [];
}

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const paramUserId = searchParams.get("userId");
  const paramDate = searchParams.get("date");

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [thaliRows, setThaliRows] = useState(emptyThaliRows);
  const [roti, setRoti] = useState(0);
  const [sabji, setSabji] = useState(0);
  const [dalRice, setDalRice] = useState(0);
  const [rice, setRice] = useState(0);
  const [orderDate, setOrderDate] = useState(todayISO);

  useEffect(() => {
    if (
      paramDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(paramDate)
    ) {
      setOrderDate(paramDate);
    }
  }, [paramDate]);

  const [previewTotal, setPreviewTotal] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasSavedOrder, setHasSavedOrder] = useState(false);

  const extraItems = useMemo(
    () => ({
      roti: Number(roti) || 0,
      sabji: Number(sabji) || 0,
      dalRice: Number(dalRice) || 0,
      rice: Number(rice) || 0,
    }),
    [roti, sabji, dalRice, rice]
  );

  const thaliIds = useMemo(
    () =>
      thaliRows
        .map((r) => Number(r.value))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5),
    [thaliRows]
  );

  const payloadBase = useMemo(
    () => ({
      thaliIds,
      extraItems,
    }),
    [thaliIds, extraItems]
  );

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        const fromUrl = paramUserId && list.some((u) => u._id === paramUserId);
        const stored =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(LAST_USER_KEY)
            : null;
        const fromStore = stored && list.some((u) => u._id === stored);
        const initial =
          (fromUrl && paramUserId) ||
          (fromStore && stored) ||
          (list[0] && list[0]._id) ||
          "";
        setUserId(initial);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paramUserId]);

  useEffect(() => {
    if (userId) {
      try {
        localStorage.setItem(LAST_USER_KEY, userId);
      } catch {
        /* ignore */
      }
    }
  }, [userId]);

  const applyOrderToForm = useCallback((order) => {
    if (!order) return;
    const ids =
      order.thaliIds?.length > 0
        ? order.thaliIds
        : order.thaliId != null
          ? [order.thaliId]
          : [];
    setThaliRows(rowsFromThaliIds(ids));
    setRoti(order.extraItems?.roti ?? 0);
    setSabji(order.extraItems?.sabji ?? 0);
    setDalRice(order.extraItems?.dalRice ?? 0);
    setRice(order.extraItems?.rice ?? 0);
    setPreviewTotal(order.totalAmount ?? null);
    setHasSavedOrder(true);
  }, []);

  useEffect(() => {
    if (!userId || loadingUsers) return;
    let cancelled = false;
    setActionError(null);
    setSavedMessage(null);
    (async () => {
      try {
        const order = await getOrderForUser(userId, orderDate);
        if (cancelled) return;
        applyOrderToForm(order);
        setSavedMessage("Loaded saved order for this date.");
      } catch (e) {
        if (cancelled) return;
        if (e.message === "Order not found") {
          setThaliRows(emptyThaliRows());
          setRoti(0);
          setSabji(0);
          setDalRice(0);
          setRice(0);
          setPreviewTotal(null);
          setHasSavedOrder(false);
          return;
        }
        setActionError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, orderDate, loadingUsers, applyOrderToForm]);

  function addThaliRow() {
    setThaliRows((prev) => [
      ...prev,
      { rowId: newRowId(), value: "1" },
    ]);
  }

  function removeThaliRow(rowId) {
    setThaliRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function setThaliRowValue(rowId, value) {
    setThaliRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, value } : r))
    );
  }

  async function onCalculate(e) {
    e.preventDefault();
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      const { totalAmount } = await previewOrder(payloadBase);
      setPreviewTotal(totalAmount);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    if (!userId) {
      setActionError("Select a user.");
      return;
    }
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      const { totalAmount, order } = await createOrder({
        userId,
        date: orderDate,
        ...payloadBase,
      });
      setPreviewTotal(totalAmount);
      if (order) applyOrderToForm(order);
      else setHasSavedOrder(true);
      setSavedMessage("Order saved for this date.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate() {
    if (!userId) {
      setActionError("Select a user.");
      return;
    }
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      const { totalAmount, order } = await updateOrder(userId, {
        date: orderDate,
        ...payloadBase,
      });
      setPreviewTotal(totalAmount);
      if (order) applyOrderToForm(order);
      else setHasSavedOrder(true);
      setSavedMessage("Order updated.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!userId || !hasSavedOrder) return;
    if (
      !window.confirm(
        "Remove this order for the selected date? It will be hidden (soft-deleted) and can be replaced by saving a new order for the same day."
      )
    ) {
      return;
    }
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      await deleteOrder(userId, orderDate);
      setThaliRows(emptyThaliRows());
      setRoti(0);
      setSabji(0);
      setDalRice(0);
      setRice(0);
      setPreviewTotal(null);
      setHasSavedOrder(false);
      setSavedMessage("Order deleted.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="panel panel--error space-y-2">
          <p className="error mb-0">{loadError}</p>
          <Link to="/" className="btn primary">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div>
          <p className="eyebrow">Kitchen</p>
          <h1>Build an order</h1>
          <p className="lede muted">
            Add as many thalis as you need, then extras and totals update live
            from the menu.
          </p>
        </div>
        <Link to="/users" className="btn btn-ghost">
          Users
        </Link>
      </div>

      <form className="form order-form card-elevated" onSubmit={onCalculate}>
        <section className="form-section">
          <h2 className="form-section-title">Who &amp; when</h2>
          <div className="grid-2">
            <label>
              User
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={loadingUsers || users.length === 0}
              >
                {users.length === 0 ? (
                  <option value="">No users — add one first</option>
                ) : (
                  users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.phone})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
              <span className="small muted">
                {formatDateDDMMYYYY(orderDate)}
              </span>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2 className="form-section-title">Thalis</h2>
            <button
              type="button"
              className="btn btn-sm primary"
              onClick={addThaliRow}
            >
              + Add thali
            </button>
          </div>
          <p className="hint muted">
            No limit — repeat the same thali for multiple plates.
          </p>
          {thaliRows.length === 0 ? (
            <div className="empty-hint">
              <p className="muted mb-0">
                No thalis yet. Tap <strong>Add thali</strong> or rely on extras
                only.
              </p>
            </div>
          ) : (
            <ul className="thali-row-list">
              {thaliRows.map((row, index) => (
                <li key={row.rowId} className="thali-row">
                  <span className="thali-row-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <select
                    value={row.value}
                    onChange={(e) =>
                      setThaliRowValue(row.rowId, e.target.value)
                    }
                    aria-label={`Thali ${index + 1}`}
                  >
                    {THALI_SELECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    onClick={() => removeThaliRow(row.rowId)}
                    aria-label={`Remove thali ${index + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <fieldset className="form-section extras">
          <legend className="form-section-title">Extra items</legend>
          <div className="grid-2">
            <label>
              Roti (₹10)
              <input
                type="number"
                min={0}
                step={1}
                value={roti}
                onChange={(e) => setRoti(e.target.value)}
              />
            </label>
            <label>
              Sabji (₹40)
              <input
                type="number"
                min={0}
                step={1}
                value={sabji}
                onChange={(e) => setSabji(e.target.value)}
              />
            </label>
            <label>
              Dal rice (₹40)
              <input
                type="number"
                min={0}
                step={1}
                value={dalRice}
                onChange={(e) => setDalRice(e.target.value)}
              />
            </label>
            <label>
              Rice (₹30)
              <input
                type="number"
                min={0}
                step={1}
                value={rice}
                onChange={(e) => setRice(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        {(actionError || savedMessage) && (
          <div
            className={`banner ${actionError ? "banner--error" : "banner--success"}`}
            role="status"
          >
            {actionError || savedMessage}
          </div>
        )}

        <div className="total-block" aria-live="polite">
          {previewTotal != null ? (
            <>
              <span className="total-label">Total</span>
              <span className="total-amount">₹{previewTotal}</span>
            </>
          ) : (
            <span className="muted">Calculate to see total</span>
          )}
        </div>

        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>
            Calculate
          </button>
          <button
            type="button"
            className="btn"
            onClick={onSave}
            disabled={busy || !userId}
          >
            {hasSavedOrder ? "Save order (replace)" : "Save order"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onUpdate}
            disabled={busy || !userId || !hasSavedOrder}
          >
            Update order
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={onDelete}
            disabled={busy || !userId || !hasSavedOrder}
          >
            Delete order
          </button>
        </div>
      </form>
    </div>
  );
}
