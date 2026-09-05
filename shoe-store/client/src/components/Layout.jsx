import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import AiAssistant from './AiAssistant.jsx';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const itemCount = cart.items?.reduce((total, item) => total + Number(item.quantity || 0), 0) || 0;
  const isCustomerPage = !['/login', '/register', '/admin'].some((path) => location.pathname.startsWith(path));

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand-link" to="/">
          Shoe Store
        </NavLink>
        <nav className="primary-nav" aria-label="Primary navigation">
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/cart">Cart{itemCount ? ` (${itemCount})` : ''}</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
        </nav>
        <div className="account-nav">
          {user ? (
            <>
              <span className="current-user">{user.email}</span>
              <button type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </div>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
      {isCustomerPage ? <AiAssistant /> : null}
    </div>
  );
}
