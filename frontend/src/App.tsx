import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Customers from "./pages/Customers";
import Portfolio from "./pages/Portfolio";

function Sidebar() {
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="dot" /> Zatu
      </div>
      <p className="tagline">Smart mobile lending</p>
      <nav className="nav">
        <NavLink to="/dashboard" className={link}>
          Dashboard
        </NavLink>
        <NavLink to="/onboarding" className={link}>
          Onboard &amp; Score
        </NavLink>
        <NavLink to="/customers" className={link}>
          Customers
        </NavLink>
        <NavLink to="/portfolio" className={link}>
          Loan Book
        </NavLink>
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/portfolio" element={<Portfolio />} />
        </Routes>
      </main>
    </div>
  );
}
