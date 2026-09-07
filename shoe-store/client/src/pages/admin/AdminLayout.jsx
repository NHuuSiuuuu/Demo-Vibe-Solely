import { BarChart3, Bell, BrainCircuit, ChevronsRight, FolderTree, Moon, Package, ShoppingCart, Sun, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

const navItems = [
  { to: '/admin', label: 'Tổng quan', icon: BarChart3, end: true },
  { to: '/admin/products', label: 'Sản phẩm', icon: Package },
  { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { to: '/admin/rag', label: 'Kho tri thức AI', icon: BrainCircuit }
];

export default function AdminLayout() {
  const { token, user, isAdmin, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

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
    <section
      className={`admin-shell${isSidebarOpen ? '' : ' admin-shell--collapsed'}${isDark ? ' admin-shell--dark' : ''}`}
      aria-label="Khu vực quản trị"
    >
      <aside className="admin-sidebar">
        <div className="admin-brand-block">
          <div className="admin-logo" aria-hidden="true">
            S
          </div>
          {isSidebarOpen ? (
            <div>
              <strong>Solely Admin</strong>
              <span>Quản trị cửa hàng</span>
            </div>
          ) : null}
        </div>

        <nav aria-label="Điều hướng quản trị">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                end={item.end}
                to={item.to}
                className={({ isActive }) => (isActive ? 'admin-nav-option active' : 'admin-nav-option')}
                title={isSidebarOpen ? undefined : item.label}
              >
                <span className="admin-nav-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {isSidebarOpen ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"
          className="admin-sidebar-toggle"
          aria-label={isSidebarOpen ? 'Thu gọn menu quản trị' : 'Mở rộng menu quản trị'}
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((current) => !current)}
        >
          <ChevronsRight size={18} aria-hidden="true" />
          {isSidebarOpen ? <span>Thu gọn</span> : null}
        </button>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Quản trị</p>
            <h1>{location.pathname === '/admin' ? 'Bảng điều khiển' : 'Vận hành cửa hàng'}</h1>
            <p>Theo dõi đơn hàng, sản phẩm và hiệu suất vận hành.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-icon-button" aria-label="Thông báo quản trị">
              <Bell size={18} aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="admin-icon-button"
              aria-label={isDark ? 'Chuyển giao diện quản trị sáng' : 'Chuyển giao diện quản trị tối'}
              onClick={() => setIsDark((current) => !current)}
            >
              {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <div className="admin-user-chip">
              <User size={18} aria-hidden="true" />
              <span>{user.email}</span>
            </div>
            <button type="button" className="button-secondary" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </section>
  );
}
