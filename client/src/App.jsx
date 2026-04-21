import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import AddUserPage from "./pages/AddUserPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import InvoicePage from "./pages/InvoicePage.jsx";
import HousekeeperPage from "./pages/HousekeeperPage.jsx";
import LightBillPage from "./pages/LightBillPage.jsx";
import ServerDownPage from "./pages/ServerDownPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import {
  API_DOWN_EVENT,
  SERVER_DOWN_PATH,
  getAuthToken,
  getStoredAuthUser,
  isServerMarkedDown,
  logout,
  setAuthToken,
  setStoredAuthUser,
} from "./api.js";
import { useTheme } from "./theme/useTheme.js";
import "./App.css";

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <label
      className="theme-switch"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <SunIcon />
      <input
        type="checkbox"
        checked={isDark}
        onChange={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      />
      <span className="theme-switch-track" aria-hidden>
        <span className="theme-switch-thumb" />
      </span>
      <MoonIcon />
    </label>
  );
}

function ProfileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UtilitiesMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const utilitiesActive =
    location.pathname.startsWith("/housekeeper") ||
    location.pathname.startsWith("/light-bill");

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="nav-dropdown" ref={menuRef}>
      <button
        type="button"
        className={`nav-dropdown-trigger ${open || utilitiesActive ? "active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Utilities
      </button>
      {open ? (
        <div className="nav-dropdown-menu" role="menu" aria-label="Utilities">
          <NavLink
            to="/housekeeper"
            className="nav-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
            }}
          >
            HouseKeeper
          </NavLink>
          <NavLink
            to="/light-bill"
            className="nav-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
            }}
          >
            Light bill
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu({ authUser, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const username = authUser?.username || authUser?.name || "User";
  const initials = String(username)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join("");

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="nav-dropdown profile-menu" ref={menuRef}>
      <button
        type="button"
        className={`profile-trigger ${open ? "active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="profile-trigger-avatar" aria-hidden>
          {initials || <ProfileIcon />}
        </span>
      </button>
      {open ? (
        <div className="profile-dropdown" role="menu" aria-label="Profile">
          <div className="profile-dropdown-user">
            <span className="small muted">Signed in as</span>
            <strong>{username}</strong>
          </div>
          <NavLink
            to="/change-password"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
            }}
          >
            Change password
          </NavLink>
          <button
            type="button"
            className="profile-menu-item profile-menu-item-theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            <span>{isDark ? "Light mode" : "Dark mode"}</span>
            <span className="profile-theme-switch" aria-hidden>
              <span className="profile-theme-switch-track">
                <span className="profile-theme-switch-thumb" />
              </span>
              {isDark ? <MoonIcon /> : <SunIcon />}
            </span>
          </button>
          <button
            type="button"
            className="profile-menu-item profile-menu-item-danger"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatGreetingName(authUser) {
  const rawName = authUser?.name || authUser?.username || "User";
  return String(rawName)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getNameInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Layout({ children, isAuthenticated, authUser, onLogout }) {
  const currentYear = new Date().getFullYear();
  const greetingName = formatGreetingName(authUser);
  const greetingInitials = getNameInitials(greetingName) || "U";

  return (
    <div className="app app-glass">
      <header className={`nav nav-glass ${isAuthenticated ? "" : "nav--minimal"}`}>
        <Link to={isAuthenticated ? "/" : "/login"} className="brand">
          {isAuthenticated ? (
            <span className="brand-greeting">
              <span className="brand-greeting-avatar" aria-hidden>
                {greetingInitials}
              </span>
              <span className="brand-greeting-text">
                <span className="brand-greeting-label">Welcome back</span>
                <strong>{greetingName}</strong>
              </span>
            </span>
          ) : (
            "Flat Expense"
          )}
        </Link>
        <div className={`nav-tools ${isAuthenticated ? "" : "nav-tools--minimal"}`}>
          {isAuthenticated ? (
            <nav className="nav-links">
              <NavLink to="/" end>
                Home
              </NavLink>
              <NavLink to="/order">Order</NavLink>
              <NavLink to="/history">History</NavLink>
              <UtilitiesMenu />
              <NavLink to="/invoice">Invoice</NavLink>
            </nav>
          ) : null}
          {isAuthenticated ? (
            <ProfileMenu authUser={authUser} onLogout={onLogout} />
          ) : (
            <ThemeToggle />
          )}
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="app-footer">
        <span>Keval Rabadiya · {currentYear}</span>
      </footer>
    </div>
  );
}

function RequireAuth({ isAuthenticated, children }) {
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const isAuthenticated = Boolean(getAuthToken() && authUser);

  useEffect(() => {
    function goServerDown() {
      if (location.pathname === SERVER_DOWN_PATH) return;
      navigate(SERVER_DOWN_PATH, { replace: true });
    }

    if (isServerMarkedDown()) {
      goServerDown();
    }

    window.addEventListener(API_DOWN_EVENT, goServerDown);
    return () => window.removeEventListener(API_DOWN_EVENT, goServerDown);
  }, [location.pathname, navigate]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session even if API is unavailable.
    } finally {
      setAuthToken("");
      setStoredAuthUser(null);
      setAuthUser(null);
      navigate("/login", { replace: true });
    }
  }

  function handleAuthChange(user) {
    setAuthUser(user);
  }

  if (location.pathname === SERVER_DOWN_PATH) {
    return (
      <Routes>
        <Route path={SERVER_DOWN_PATH} element={<ServerDownPage />} />
      </Routes>
    );
  }

  return (
    <Layout
      isAuthenticated={isAuthenticated}
      authUser={authUser}
      onLogout={handleLogout}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              isAuthenticated={isAuthenticated}
              onAuthChange={handleAuthChange}
            />
          }
        />
        <Route
          path="/register"
          element={
            <RegisterPage
              isAuthenticated={isAuthenticated}
              onAuthChange={handleAuthChange}
            />
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users/new"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <AddUserPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/invoice"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <InvoicePage authUser={authUser} />
            </RequireAuth>
          }
        />
        <Route
          path="/housekeeper"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <HousekeeperPage />
            </RequireAuth>
          }
        />
        <Route
          path="/light-bill"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <LightBillPage />
            </RequireAuth>
          }
        />
        <Route
          path="/order"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <OrderPage authUser={authUser} />
            </RequireAuth>
          }
        />
        <Route
          path="/change-password"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />
        <Route path={SERVER_DOWN_PATH} element={<ServerDownPage />} />
      </Routes>
    </Layout>
  );
}
