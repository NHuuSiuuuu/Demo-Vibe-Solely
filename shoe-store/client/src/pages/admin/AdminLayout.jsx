import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function AdminLayout() {
  const { token, user, isAdmin } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <p className="muted">Loading admin session...</p>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="admin-shell" aria-label="Admin workspace">
      <aside className="admin-sidebar">
        <nav aria-label="Admin navigation">
          <NavLink end to="/admin">
            Dashboard
          </NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Store operations</h1>
          </div>
          <span className="current-user">{user.email}</span>
        </header>
        <Outlet />
      </div>
    </section>
  );
}
