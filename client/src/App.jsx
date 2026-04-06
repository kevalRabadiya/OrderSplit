import { Link, NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import AddUserPage from "./pages/AddUserPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import InvoicePage from "./pages/InvoicePage.jsx";
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

function Layout({ children }) {
  return (
    <div className="app">
      <header className="nav">
        <Link to="/" className="brand">
          Tiffin orders
        </Link>
        <div className="nav-tools">
          <nav className="nav-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/users">Users</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/invoice">Invoice</NavLink>
            <NavLink to="/order">Order</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<AddUserPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/invoice" element={<InvoicePage />} />
        <Route path="/order" element={<OrderPage />} />
      </Routes>
    </Layout>
  );
}
