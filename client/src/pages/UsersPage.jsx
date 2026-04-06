import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUsers } from "../api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

  if (loading) return <p className="muted">Loading users…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Users</h1>
        <Link to="/users/new" className="btn primary">
          Add user
        </Link>
      </div>
      {users.length === 0 ? (
        <p className="muted">No users yet. Add one to get started.</p>
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
                className="btn"
              >
                Add order
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
