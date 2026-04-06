import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createOrder,
  getOrderForUser,
  getUsers,
  previewOrder,
} from "../api";

const LAST_USER_KEY = "tiffin_lastUserId";

const THALI_OPTIONS = [
  { value: "", label: "None" },
  { value: "1", label: "Thali 1 — ₹110 (sabji-1, sabji-2, 5 roti, 1 dal-bhat)" },
  { value: "2", label: "Thali 2 — ₹110 (sabji-1, sabji-2, 8 roti)" },
  { value: "3", label: "Thali 3 — ₹90 (sabji-1, 5 roti, 1 dal-bhat)" },
  { value: "4", label: "Thali 4 — ₹90 (sabji-1, sabji-2, 5 roti)" },
  { value: "5", label: "Thali 5 — ₹75 (sabji-1, 5 roti)" },
];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const paramUserId = searchParams.get("userId");

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [thali, setThali] = useState("");
  const [roti, setRoti] = useState(0);
  const [sabji, setSabji] = useState(0);
  const [dalRice, setDalRice] = useState(0);
  const [rice, setRice] = useState(0);
  const [orderDate, setOrderDate] = useState(todayISO);

  const [previewTotal, setPreviewTotal] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);

  const extraItems = useMemo(
    () => ({
      roti: Number(roti) || 0,
      sabji: Number(sabji) || 0,
      dalRice: Number(dalRice) || 0,
      rice: Number(rice) || 0,
    }),
    [roti, sabji, dalRice, rice]
  );

  const payloadBase = useMemo(() => {
    const thaliId =
      thali === "" || thali === "none" ? null : Number(thali);
    return {
      thaliId,
      extraItems,
    };
  }, [thali, extraItems]);

  useEffect(() => {
    let cancelled = false;
    setLoadingUsers(true);
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

  useEffect(() => {
    if (!userId || loadingUsers) return;
    let cancelled = false;
    setActionError(null);
    setSavedMessage(null);
    (async () => {
      try {
        const order = await getOrderForUser(userId, orderDate);
        if (cancelled) return;
        setThali(order.thaliId == null ? "" : String(order.thaliId));
        setRoti(order.extraItems?.roti ?? 0);
        setSabji(order.extraItems?.sabji ?? 0);
        setDalRice(order.extraItems?.dalRice ?? 0);
        setRice(order.extraItems?.rice ?? 0);
        setPreviewTotal(order.totalAmount);
        setSavedMessage("Loaded saved order for this date.");
      } catch (e) {
        if (cancelled) return;
        if (e.message === "Order not found") {
          setThali("");
          setRoti(0);
          setSabji(0);
          setDalRice(0);
          setRice(0);
          setPreviewTotal(null);
          return;
        }
        setActionError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, orderDate, loadingUsers]);

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
      const { totalAmount } = await createOrder({
        userId,
        date: orderDate,
        ...payloadBase,
      });
      setPreviewTotal(totalAmount);
      setSavedMessage("Order saved for this date.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <p className="error">{loadError}</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Today&apos;s order</h1>
        <Link to="/" className="btn">
          Users
        </Link>
      </div>

      <form className="form order-form" onSubmit={onCalculate}>
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
          Order date
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </label>

        <label>
          Thali
          <select value={thali} onChange={(e) => setThali(e.target.value)}>
            {THALI_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="extras">
          <legend>Extra items</legend>
          <div className="grid-2">
            <label>
              Roti (₹10 each)
              <input
                type="number"
                min={0}
                step={1}
                value={roti}
                onChange={(e) => setRoti(e.target.value)}
              />
            </label>
            <label>
              Sabji (₹40 each)
              <input
                type="number"
                min={0}
                step={1}
                value={sabji}
                onChange={(e) => setSabji(e.target.value)}
              />
            </label>
            <label>
              Dal rice (₹40 each)
              <input
                type="number"
                min={0}
                step={1}
                value={dalRice}
                onChange={(e) => setDalRice(e.target.value)}
              />
            </label>
            <label>
              Rice (₹30 each)
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

        {actionError ? <p className="error">{actionError}</p> : null}
        {savedMessage ? <p className="success">{savedMessage}</p> : null}

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
            Save order
          </button>
        </div>
      </form>
    </div>
  );
}
