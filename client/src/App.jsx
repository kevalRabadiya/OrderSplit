import { Link, NavLink, Route, Routes } from "react-router-dom";
import UsersPage from "./pages/UsersPage.jsx";
import AddUserPage from "./pages/AddUserPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import "./App.css";

function Layout({ children }) {
  return (
    <div className="app">
      <header className="nav">
        <Link to="/" className="brand">
          Tiffin orders
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Users
          </NavLink>
          <NavLink to="/users/new">Add user</NavLink>
          <NavLink to="/order">Order</NavLink>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<UsersPage />} />
        <Route path="/users/new" element={<AddUserPage />} />
        <Route path="/order" element={<OrderPage />} />
      </Routes>
    </Layout>
  );
}
