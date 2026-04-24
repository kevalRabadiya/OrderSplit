import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUser } from "../api";
import { toast } from "../lib/toast.js";

export default function AddUserPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRe.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setSaving(true);
    try {
      await createUser({
        name,
        phone,
        email: normalizedEmail,
        address: address.trim() || undefined,
        username: username.trim().toLowerCase(),
        password,
      });
      toast.success("User added.");
      navigate("/users");
    } catch (err) {
      const msg = err.message || "Could not add user.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page premium-shell premium-page">
      <div className="page-head glass-hero premium-hero motion-fade-up">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>New user</h1>
          <p className="lede muted">
            Name and phone are required; address helps delivery runners.
          </p>
        </div>
        <Link to="/users" className="btn btn-ghost">
          Back
        </Link>
      </div>
      <form className="form card-elevated glass-panel-3d depth-card neon-edge motion-fade-up motion-delay-1" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="e.g. John Doe"
          />
        </label>
        <label>
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            placeholder="+91 …"
          />
        </label>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
          />
        </label>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            placeholder="e.g. john.doe"
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            minLength={4}
            autoComplete="new-password"
            required
            placeholder="Min 4 characters"
          />
        </label>
        <label>
          Address <span className="muted">(optional)</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="Building, area, landmark"
          />
        </label>
        {error ? (
          <div className="banner banner--error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving…" : "Save user"}
        </button>
      </form>
    </div>
  );
}
