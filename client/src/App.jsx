import { Link, NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import AddUserPage from "./pages/AddUserPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import InvoicePage from "./pages/InvoicePage.jsx";
import { useTheme } from "./theme/ThemeContext.jsx";
import "./App.css";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <select
      className="theme-select"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      aria-label="Color theme"
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
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
