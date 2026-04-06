import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUser } from "../api";

export default function AddUserPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createUser({
        name,
        phone,
        address: address.trim() || undefined,
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Add user</h1>
        <Link to="/" className="btn">
          Back
        </Link>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
          />
        </label>
        <label>
          Address <span className="muted">(optional)</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving…" : "Save user"}
        </button>
      </form>
    </div>
  );
}
