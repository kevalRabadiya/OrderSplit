import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { register, setAuthToken, setStoredAuthUser } from "../api";

function EyeOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.1 12S5.8 5 12 5s9.9 7 9.9 7-3.7 7-9.9 7-9.9-7-9.9-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A9.3 9.3 0 0 1 12 5c6.2 0 9.9 7 9.9 7a17.3 17.3 0 0 1-4.1 4.9" />
      <path d="M6.2 6.2A17.9 17.9 0 0 0 2.1 12S5.8 19 12 19c1.6 0 3.1-.5 4.5-1.3" />
    </svg>
  );
}

export default function RegisterPage({ isAuthenticated, onAuthChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = form.email.trim().toLowerCase();
  const emailInvalid = form.email.length > 0 && !emailRe.test(normalizedEmail);
  const isPasswordShort = form.password.length > 0 && form.password.length < 4;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!emailRe.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setSaving(true);
    try {
      const data = await register({
        ...form,
        email: normalizedEmail,
        username: form.username.trim().toLowerCase(),
        address: form.address.trim() || undefined,
      });
      setAuthToken(data.token);
      setStoredAuthUser(data.user);
      onAuthChange(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-shell">
        <form className="form card-elevated auth-card auth-card-register" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="auth-badge" aria-hidden>
              ✦
            </span>
            <h2 className="auth-card-title">Register</h2>
            <p className="muted small mb-0 auth-card-subtitle">
              Create your profile and credentials.
            </p>
          </div>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
              required
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              autoComplete="tel"
              placeholder="Phone number"
              required
            />
          </label>
          <label>
            Email
            <input
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              type="email"
              autoComplete="email"
              className={emailInvalid ? "field-error" : ""}
              aria-invalid={emailInvalid}
              placeholder="name@example.com"
              required
            />
          </label>
          <label>
            Address <span className="muted">(optional)</span>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              placeholder="Building, area, landmark"
            />
          </label>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              autoComplete="username"
              placeholder="Choose username"
              required
            />
          </label>
          <label>
            Password
            <div className="auth-password-wrap">
              <input
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                type={showPassword ? "text" : "password"}
                className={isPasswordShort ? "field-error" : ""}
                aria-invalid={isPasswordShort}
                minLength={4}
                autoComplete="new-password"
                placeholder="Minimum 4 characters"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </label>
          <p className={`auth-validation-note ${emailInvalid || isPasswordShort ? "invalid" : ""}`}>
            Username is case-insensitive. Use a valid email and at least 4-character password.
          </p>
          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="btn primary auth-submit-btn" disabled={saving}>
            {saving ? "Creating account…" : "Register"}
          </button>
          <p className="hint auth-hint">
            Already registered? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
