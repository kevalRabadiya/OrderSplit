import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { getUsers } from "../api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-block">
          <Loader label="Loading users…" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="panel panel--error">
          <p className="error mb-0">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Users</h1>
          <p className="lede muted">
            Everyone who orders from you — open an order in one tap.
          </p>
        </div>
        <Link to="/users/new" className="btn primary">
          Add user
        </Link>
      </div>
      {users.length === 0 ? (
        <div className="empty-hint">
          <p className="muted mb-0">
            No users yet. <Link to="/users/new">Add your first user</Link>{" "}
            to start taking orders.
          </p>
        </div>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li key={u._id} className="user-card">
              <div className="user-meta">
                <strong>{u.name}</strong>
                <span className="muted">{u.phone}</span>
                {u.address ? <span className="small">{u.address}</span> : null}
              </div>
              <Link
                to={`/order?userId=${encodeURIComponent(u._id)}`}
                className="btn primary btn-sm"
              >
                New order
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
