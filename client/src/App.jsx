import { useEffect, useRef, useState } from "react";
import {
  Link,
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
import {
  API_DOWN_EVENT,
  SERVER_DOWN_PATH,
  isServerMarkedDown,
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
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
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
            onClick={() => setOpen(false)}
          >
            HouseKeeper
          </NavLink>
          <NavLink
            to="/light-bill"
            className="nav-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Light bill
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}

function Layout({ children }) {
  return (
    <div className="app">
      <header className="nav">
        <Link to="/" className="brand">
          Flat Expense
        </Link>
        <div className="nav-tools">
          <nav className="nav-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/order">Order</NavLink>
            <NavLink to="/history">History</NavLink>
            <UtilitiesMenu />
            <NavLink to="/invoice">Invoice</NavLink>
            <NavLink to="/users">Users</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

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

  if (location.pathname === SERVER_DOWN_PATH) {
    return (
      <Routes>
        <Route path={SERVER_DOWN_PATH} element={<ServerDownPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<AddUserPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/invoice" element={<InvoicePage />} />
        <Route path="/housekeeper" element={<HousekeeperPage />} />
        <Route path="/light-bill" element={<LightBillPage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path={SERVER_DOWN_PATH} element={<ServerDownPage />} />
      </Routes>
    </Layout>
  );
}
