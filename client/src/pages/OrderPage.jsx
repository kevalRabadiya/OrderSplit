import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import {
  createOrder,
  deleteOrder,
  getOrderForUser,
  previewOrder,
  updateOrder,
} from "../api";
import { formatDateDDMMYYYY } from "../utils/dateFormat.js";

function newRowId() {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random()}`;
}

const THALI_SELECT_OPTIONS = [
  { value: "1", label: "Thali 1 [ sabji x 2, roti x 5, dalRice x 1 ] " },
  { value: "2", label: "Thali 2 [ sabji x 2, roti x 8 ]" },
  { value: "3", label: "Thali 3 [ sabji x 1, roti x 5, dalRice x 1 ] " },
  { value: "4", label: "Thali 4 [ sabji x 2, roti x 5 ]" },
  { value: "5", label: "Thali 5 [ sabji x 1, roti x 5 ]" },
];

const DAL_RICE_OPTIONS = [
  { value: "", label: "None" },
  { value: "Pulav", label: "Pulav" },
  { value: "Khichdi", label: "Khichdi" },
  { value: "Dalrice", label: "Dalrice" },
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

/** Avoid `n || 0` (0 is valid) and coerce number inputs safely for the API. */
function toNonNegIntField(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 0;
  return n;
}

export default function OrderPage({ authUser }) {
  const [searchParams] = useSearchParams();
  const paramDate = searchParams.get("date");
  const currentUserId = authUser?._id || "";

  const [thaliRows, setThaliRows] = useState(emptyThaliRows);
  const [roti, setRoti] = useState(0);
  const [sabji1, setSabji1] = useState("");
  const [sabji2, setSabji2] = useState("");
  const [dalRiceType, setDalRiceType] = useState("");
  const [rice, setRice] = useState(0);
  const [description, setDescription] = useState("");
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
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasSavedOrder, setHasSavedOrder] = useState(false);

  const extraItems = useMemo(
    () => ({
      roti: toNonNegIntField(roti),
      rice: toNonNegIntField(rice),
      sabji1: typeof sabji1 === "string" ? sabji1 : String(sabji1 ?? ""),
      sabji2: typeof sabji2 === "string" ? sabji2 : String(sabji2 ?? ""),
      dalRiceType:
        dalRiceType === "Pulav" ||
        dalRiceType === "Khichdi" ||
        dalRiceType === "Dalrice"
          ? dalRiceType
          : "",
    }),
    [roti, rice, sabji1, sabji2, dalRiceType]
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
      description: description.trim(),
    }),
    [thaliIds, extraItems, description]
  );

  const payloadRef = useRef(payloadBase);
  payloadRef.current = payloadBase;

  /** Only apply the latest preview (debounced or Calculate); drop stale HTTP responses. */
  const previewGenRef = useRef(0);

  const dalRiceFieldLabel =
    dalRiceType === "Pulav" ||
    dalRiceType === "Khichdi" ||
    dalRiceType === "Dalrice"
      ? `${dalRiceType} (₹40)`
      : "Dal rice (₹40)";

  /** Keep total in sync when thalis / extras change (preview uses latest payload). */
  useEffect(() => {
    if (loadingOrder) return;
    const id = setTimeout(() => {
      const g = ++previewGenRef.current;
      previewOrder(payloadRef.current)
        .then(({ totalAmount }) => {
          if (g === previewGenRef.current) {
            setPreviewTotal(totalAmount);
          }
        })
        .catch(() => {
          /* errors surfaced via Calculate / Save */
        });
    }, 300);
    return () => clearTimeout(id);
  }, [payloadBase, loadingOrder]);

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
    setSabji1(
      typeof order.extraItems?.sabji1 === "string"
        ? order.extraItems.sabji1
        : ""
    );
    setSabji2(
      typeof order.extraItems?.sabji2 === "string"
        ? order.extraItems.sabji2
        : ""
    );
    const drt = order.extraItems?.dalRiceType;
    setDalRiceType(
      drt === "Pulav" || drt === "Khichdi" || drt === "Dalrice" ? drt : ""
    );
    setRice(order.extraItems?.rice ?? 0);
    setDescription(
      typeof order.description === "string" ? order.description : ""
    );
    setPreviewTotal(order.totalAmount ?? null);
    setHasSavedOrder(true);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setLoadError("Missing logged-in user. Please login again.");
      return;
    }
    let cancelled = false;
    setActionError(null);
    setSavedMessage(null);
    setLoadingOrder(true);
    (async () => {
      try {
        const order = await getOrderForUser(currentUserId, orderDate);
        if (cancelled) return;
        applyOrderToForm(order);
        setSavedMessage("Loaded saved order for this date.");
      } catch (e) {
        if (cancelled) return;
        if (e.message === "Order not found") {
          setThaliRows(emptyThaliRows());
          setRoti(0);
          setSabji1("");
          setSabji2("");
          setDalRiceType("");
          setRice(0);
          setDescription("");
          setPreviewTotal(null);
          setHasSavedOrder(false);
          return;
        }
        setActionError(e.message);
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, orderDate, applyOrderToForm]);

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
    const g = ++previewGenRef.current;
    try {
      const { totalAmount } = await previewOrder(payloadRef.current);
      if (g === previewGenRef.current) {
        setPreviewTotal(totalAmount);
      }
    } catch (err) {
      if (g === previewGenRef.current) {
        setActionError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    if (!currentUserId) {
      setActionError("Missing logged-in user.");
      return;
    }
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      const { totalAmount, order } = await createOrder({
        userId: currentUserId,
        date: orderDate,
        ...payloadRef.current,
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
    if (!currentUserId) {
      setActionError("Missing logged-in user.");
      return;
    }
    setActionError(null);
    setSavedMessage(null);
    setBusy(true);
    try {
      const { totalAmount, order } = await updateOrder(currentUserId, {
        date: orderDate,
        ...payloadRef.current,
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
    if (!currentUserId || !hasSavedOrder) return;
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
      await deleteOrder(currentUserId, orderDate);
      setThaliRows(emptyThaliRows());
      setRoti(0);
      setSabji1("");
      setSabji2("");
      setDalRiceType("");
      setRice(0);
      setDescription("");
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

  const actionsDisabled = busy || loadingOrder;

  return (
    <div className="page page--wide order-page">
      <div className="page-head order-page-head glass-hero">
        <div>
          <p className="eyebrow">Kitchen</p>
          <h1>Build an order</h1>
          <p className="lede muted">
            Add as many thalis as you need, then extras and totals update live
            from the menu.
          </p>
        </div>
        {/* <span className="muted small">
          User: {authUser?.username || authUser?.name || "User"}
        </span> */}
      </div>
      <form
        className="form order-form order-form--enhanced card-elevated glass-surface"
        onSubmit={onCalculate}
      >
        <section className="form-section order-section order-section--meta glass-surface">
          <h2 className="form-section-title">When</h2>
          {/* <div className="order-current-user-card" role="status" aria-live="polite"> */}
            {/* <span className="small muted">Current user</span>
            <strong>{authUser?.username || authUser?.name || "User"}</strong> */}
          {/* </div> */}
          <div className="grid-2">
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
          {loadingOrder ? (
            <Loader
              variant="inline"
              label="Loading order for this date…"
            />
          ) : null}
        </section>

        <section className="form-section order-section order-section--thali glass-surface">
          <div className="form-section-head">
            <h2 className="form-section-title">Thalis</h2>
            <button
              type="button"
              className="btn btn-sm primary"
              onClick={addThaliRow}
              disabled={actionsDisabled}
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
            <ul className="thali-row-list order-thali-list">
              {thaliRows.map((row, index) => (
                <li key={row.rowId} className="thali-row order-thali-row">
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
                    className="btn btn-sm btn-icon order-thali-remove"
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

        <fieldset className="form-section extras order-section order-section--extras glass-surface">
          <legend className="form-section-title">Extra items</legend>
          <p className="hint muted mb-0">
            Each filled sabji name adds ₹40. One dal-rice choice adds ₹40.
          </p>
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
              Rice (₹30)
              <input
                type="number"
                min={0}
                step={1}
                value={rice}
                onChange={(e) => setRice(e.target.value)}
              />
            </label>
            <label>
              Sabji 1 <span className="muted">(₹40 if filled)</span>
              <input
                type="text"
                value={sabji1}
                onChange={(e) => setSabji1(e.target.value)}
                placeholder="e.g. Aloo gobi"
                autoComplete="off"
                maxLength={80}
              />
            </label>
            <label>
              Sabji 2 <span className="muted">(₹40 if filled)</span>
              <input
                type="text"
                value={sabji2}
                onChange={(e) => setSabji2(e.target.value)}
                placeholder="e.g. Dal tadka"
                autoComplete="off"
                maxLength={80}
              />
            </label>
            <label className="extras-grid-full">
              {dalRiceFieldLabel}
              <select
                value={dalRiceType}
                onChange={(e) => setDalRiceType(e.target.value)}
              >
                {DAL_RICE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <section className="form-section order-section order-section--note glass-surface">
          <h2 className="form-section-title">Description</h2>
          <label>
            Order note (optional)
            <textarea
              className="order-note-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any delivery/kitchen note for this order"
              maxLength={400}
              rows={3}
            />
            <span className="small muted">
              {description.length}/400
            </span>
          </label>
        </section>

        {(actionError || savedMessage) && (
          <div
            className={`banner ${actionError ? "banner--error" : "banner--success"}`}
            role="status"
          >
            {actionError || savedMessage}
          </div>
        )}

        <div className="total-block order-total-block glass-surface" aria-live="polite">
          {previewTotal != null ? (
            <>
              <span className="total-label">Total</span>
              <span className="total-amount">₹{previewTotal}</span>
            </>
          ) : (
            <span className="muted">Calculate to see total</span>
          )}
        </div>

        <div className="actions order-actions">
          {previewTotal == null ? (
            <button
              type="submit"
              className="btn primary"
              disabled={actionsDisabled}
            >
              Calculate
            </button>
          ) : null}
          <button
            type="button"
            className="btn primary"
            onClick={onSave}
            disabled={actionsDisabled || !currentUserId}
          >
            {hasSavedOrder ? "Save order (replace)" : "Save order"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onUpdate}
            disabled={actionsDisabled || !currentUserId || !hasSavedOrder}
          >
            Update order
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={onDelete}
            disabled={actionsDisabled || !currentUserId || !hasSavedOrder}
          >
            Delete order
          </button>
        </div>
      </form>
    </div>
  );
}
