import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function AdminLayout() {
  const { token, user, isAdmin } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <p className="muted">Đang tải phiên quản trị...</p>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="admin-shell" aria-label="Khu vực quản trị">
      <aside className="admin-sidebar">
        <nav aria-label="Điều hướng quản trị">
          <NavLink end to="/admin">
            Tổng quan
          </NavLink>
          <NavLink to="/admin/products">Sản phẩm</NavLink>
          <NavLink to="/admin/orders">Đơn hàng</NavLink>
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Quản trị</p>
            <h1>Vận hành cửa hàng</h1>
          </div>
          <span className="current-user">{user.email}</span>
        </header>
        <Outlet />
      </div>
    </section>
  );
}
