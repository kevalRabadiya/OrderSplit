import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { login, setAuthToken, setStoredAuthUser } from "../api";

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

export default function LoginPage({ isAuthenticated, onAuthChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const nextPath = location.state?.from?.pathname || "/";
  const usernameNormalized = username.trim().toLowerCase();
  const isPasswordShort = password.length > 0 && password.length < 4;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await login({
        username: usernameNormalized,
        password,
      });
      setAuthToken(data.token);
      setStoredAuthUser(data.user);
      onAuthChange(data.user);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-shell">
        <form className="form card-elevated auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="auth-badge" aria-hidden>
              ✦
            </span>
            <h2 className="auth-card-title">Login</h2>
            <p className="muted small mb-0">Use your username and password.</p>
          </div>

          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Enter username"
              required
            />
          </label>

          <label>
            Password
            <div className="auth-password-wrap">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className={isPasswordShort ? "field-error" : ""}
                aria-invalid={isPasswordShort}
                minLength={4}
                autoComplete="current-password"
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
          <p className={`auth-validation-note ${isPasswordShort ? "invalid" : ""}`}>
            Password must be at least 4 characters.
          </p>

          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn primary auth-submit-btn" disabled={saving}>
            {saving ? "Logging in…" : "Login"}
          </button>

          <p className="hint auth-hint">
            New user? <Link to="/register">Create account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
