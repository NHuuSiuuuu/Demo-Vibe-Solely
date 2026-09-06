import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import AiAssistant from './AiAssistant.jsx';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const itemCount = cart.items?.reduce((total, item) => total + Number(item.quantity || 0), 0) || 0;
  const isCustomerPage = !['/login', '/register', '/admin'].some((path) => location.pathname.startsWith(path));

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand-link" to="/">
          Solely
        </NavLink>
        <button
          type="button"
          className="icon-button menu-toggle"
          aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <nav className={`primary-nav${isMenuOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
          <NavLink to="/products?sort=newest" onClick={() => setIsMenuOpen(false)}>
            Hàng mới
          </NavLink>
          <NavLink to="/products?category=sneakers" onClick={() => setIsMenuOpen(false)}>
            Sneaker
          </NavLink>
          <NavLink to="/products?category=running" onClick={() => setIsMenuOpen(false)}>
            Chạy bộ
          </NavLink>
          <NavLink to="/products?category=lifestyle" onClick={() => setIsMenuOpen(false)}>
            Phong cách sống
          </NavLink>
          <NavLink to="/orders" onClick={() => setIsMenuOpen(false)}>
            Đơn hàng
          </NavLink>
          {isAdmin ? (
            <NavLink to="/admin" onClick={() => setIsMenuOpen(false)}>
              Quản trị
            </NavLink>
          ) : null}
        </nav>
        <div className="header-actions">
          <button type="button" className="icon-button" aria-label="Tìm kiếm sản phẩm">
            <Search size={19} aria-hidden="true" />
          </button>
          {user ? (
            <>
              <NavLink className="icon-button" to="/orders" aria-label="Tài khoản">
                <User size={19} aria-hidden="true" />
              </NavLink>
              <button type="button" className="text-button" onClick={logout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink className="icon-button" to="/login" aria-label="Tài khoản">
              <User size={19} aria-hidden="true" />
            </NavLink>
          )}
          <button type="button" className="icon-button" aria-label="Danh sách yêu thích">
            <Heart size={19} aria-hidden="true" />
          </button>
          <NavLink className="bag-link" to="/cart" aria-label={`Túi hàng ${itemCount} sản phẩm`}>
            <ShoppingBag size={19} aria-hidden="true" />
            <span>{itemCount}</span>
          </NavLink>
        </div>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <NavLink className="brand-link" to="/">
            Solely
          </NavLink>
          <p>Sneaker tối giản, êm nhẹ và bền bỉ cho nhịp sống mỗi ngày.</p>
        </div>
        <nav aria-label="Liên kết chân trang">
          <div>
            <h2>Mua sắm</h2>
            <NavLink to="/products">Sản phẩm</NavLink>
            <NavLink to="/products?sort=newest">Hàng mới</NavLink>
            <NavLink to="/cart">Túi hàng</NavLink>
          </div>
          <div>
            <h2>Thương hiệu</h2>
            <a href="#story">Câu chuyện</a>
            <a href="#materials">Chất liệu</a>
            <a href="#newsletter">Bản tin</a>
          </div>
          <div>
            <h2>Hỗ trợ</h2>
            <NavLink to="/orders">Theo dõi đơn</NavLink>
            <NavLink to="/login">Tài khoản</NavLink>
            <a href="mailto:support@solely.local">Liên hệ</a>
          </div>
        </nav>
        <p className="footer-copy">© 2026 Solely. Bảo lưu mọi quyền.</p>
      </footer>
      {isCustomerPage ? <AiAssistant /> : null}
    </div>
  );
}
