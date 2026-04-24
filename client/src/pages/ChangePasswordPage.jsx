import { useState } from "react";
import { changePassword } from "../api";
import { toast } from "../lib/toast.js";

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

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isNewPasswordShort = newPassword.length > 0 && newPassword.length < 4;
  const isSameAsCurrent =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    currentPassword === newPassword;
  const doesNotMatch =
    confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const canSubmit =
    !saving &&
    currentPassword.length > 0 &&
    newPassword.length >= 4 &&
    !isSameAsCurrent &&
    !doesNotMatch;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    if (isNewPasswordShort) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (isSameAsCurrent) {
      setError("New password must be different from current password.");
      return;
    }
    if (doesNotMatch) {
      setError("New password and confirm password must match.");
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password changed successfully.");
    } catch (err) {
      const msg = err.message || "Failed to change password";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page auth-page premium-shell premium-page">
      <div className="auth-shell">
        <form className="form card-elevated auth-card auth-card-change-password glass-panel-3d depth-card neon-edge motion-fade-up" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="auth-badge" aria-hidden>
              ✦
            </span>
            <h2 className="auth-card-title">Change password</h2>
            <p className="muted small mb-0 auth-card-subtitle">
              Enter your current password, then choose a new one.
            </p>
          </div>

          <label>
            Current password
            <div className="auth-password-wrap">
              <input
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </label>

          <label>
            New password
            <div className="auth-password-wrap">
              <input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={isNewPasswordShort || isSameAsCurrent ? "field-error" : ""}
                placeholder="Minimum 4 characters"
                minLength={4}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </label>

          <label>
            Confirm new password
            <div className="auth-password-wrap">
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={doesNotMatch ? "field-error" : ""}
                placeholder="Re-enter new password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </label>

          <p
            className={`auth-validation-note ${
              isNewPasswordShort || isSameAsCurrent || doesNotMatch ? "invalid" : ""
            }`}
          >
            {isNewPasswordShort
              ? "New password must be at least 4 characters."
              : isSameAsCurrent
                ? "New password must be different from current password."
                : doesNotMatch
                  ? "Confirm password must match new password."
                  : "Use a password different from your current one."}
          </p>

          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="btn primary auth-submit-btn" disabled={!canSubmit}>
            {saving ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
