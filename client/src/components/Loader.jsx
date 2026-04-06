/**
 * @param {{ label?: string; variant?: "block" | "inline" }} props
 */
export default function Loader({ label = "Loading…", variant = "block" }) {
  const rootClass =
    variant === "inline" ? "loader loader--inline" : "loader loader--block";
  return (
    <div className={rootClass} role="status" aria-live="polite">
      <span className="loader-spinner" aria-hidden="true" />
      <span className="loader-label">{label}</span>
    </div>
  );
}
