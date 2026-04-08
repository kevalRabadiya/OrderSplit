import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearServerDownMark, getServerHealth } from "../api.js";

export default function ServerDownPage() {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");

  async function onRetry() {
    setRetrying(true);
    setMessage("");
    try {
      await getServerHealth();
      clearServerDownMark();
      navigate("/", { replace: true });
    } catch {
      setMessage("Still unavailable. Please try again in a few seconds.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section className="server-down" aria-live="polite">
      <div className="server-down__bg" aria-hidden />
      <div className="server-down__card">
        <p className="server-down__eyebrow">Connection Lost</p>
        <h1>Server is down</h1>
        <p className="server-down__lede">
          We are unable to reach the API right now. The app will work again as
          soon as the server is back online.
        </p>
        <div className="server-down__actions">
          <button
            type="button"
            className="btn primary"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? "Checking..." : "Retry Connection"}
          </button>
        </div>
        {message ? <p className="server-down__error">{message}</p> : null}
      </div>
    </section>
  );
}
