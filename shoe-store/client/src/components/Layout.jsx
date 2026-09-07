import { Camera, Heart, Menu, Moon, Search, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import { getImageSearchError } from '../utils/imageSearch.js';
import AiAssistant from './AiAssistant.jsx';

const THEME_STORAGE_KEY = 'shoe_store_theme';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'light');
  const headerFileInputRef = useRef(null);
  const headerTextSearchNonceRef = useRef(0);
  const suggestionsRequestRef = useRef(null);
  const itemCount = cart.items?.reduce((total, item) => total + Number(item.quantity || 0), 0) || 0;
  const isCustomerPage = !['/login', '/register', '/admin'].some((path) => location.pathname.startsWith(path));
  const isDarkTheme = theme === 'dark';

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const query = location.pathname === '/products' ? new URLSearchParams(location.search).get('q') || '' : '';
    setSearchQuery(query);
    setSearchError('');
  }, [location.pathname, location.search]);

  useEffect(() => {
    const query = searchQuery.trim();
    suggestionsRequestRef.current?.abort();
    setSuggestionsError('');

    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    suggestionsRequestRef.current = controller;
    setSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get(`/api/products?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!controller.signal.aborted) {
          setSuggestions((data.products || []).slice(0, 5));
          setSuggestionsLoading(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsLoading(false);
          setSuggestionsError(error.message || 'Không thể tải gợi ý sản phẩm.');
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  function submitSearch(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    const params = new URLSearchParams();
    if (query) {
      params.set('q', query);
    }
    setIsMenuOpen(false);
    setSearchError('');
    setSuggestions([]);
    suggestionsRequestRef.current?.abort();
    headerTextSearchNonceRef.current += 1;
    navigate(params.size ? `/products?${params.toString()}` : '/products', {
      state: { headerTextSearchNonce: headerTextSearchNonceRef.current }
    });
  }

  function selectHeaderImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const validationError = getImageSearchError(file);
    if (validationError) {
      setSearchError(validationError);
      return;
    }

    setSearchError('');
    setIsMenuOpen(false);
    navigate('/products', { state: { imageSearchFile: file } });
  }

  return (
    <div className={`app-shell app-shell--${theme}`}>
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
        <form className="header-search" role="search" aria-label="Tìm kiếm sản phẩm toàn cửa hàng" onSubmit={submitSearch}>
          <label className="header-search__label" htmlFor="header-product-query">
            Tìm kiếm sản phẩm
          </label>
          <div className="header-search__control">
            <input
              id="header-product-query"
              type="search"
              value={searchQuery}
              placeholder="Tìm sản phẩm"
              aria-describedby={searchError ? 'header-search-error' : undefined}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit" className="header-search__button" aria-label="Tìm kiếm">
              <Search size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="header-search__button"
              aria-label="Tìm sản phẩm bằng hình ảnh từ thanh đầu trang"
              onClick={() => headerFileInputRef.current?.click()}
            >
              <Camera size={18} aria-hidden="true" />
            </button>
          </div>
          {searchQuery.trim().length >= 2 ? (
            <div className="header-search__suggestions" role="listbox" aria-label="Gợi ý sản phẩm">
              {suggestionsLoading ? <p className="header-search__suggestions-status">Đang tìm sản phẩm...</p> : null}
              {!suggestionsLoading && suggestionsError ? (
                <p className="header-search__suggestions-status header-search__suggestions-status--error">
                  {suggestionsError}
                </p>
              ) : null}
              {!suggestionsLoading && !suggestionsError && suggestions.length === 0 ? (
                <p className="header-search__suggestions-status">Không tìm thấy sản phẩm.</p>
              ) : null}
              {!suggestionsLoading && !suggestionsError ? suggestions.map((product) => (
                <Link
                  className="header-search__suggestion"
                  key={product.id}
                  role="option"
                  to={`/products/${product.slug}`}
                  onClick={() => setSuggestions([])}
                >
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="header-search__suggestion-fallback">S</span>}
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.brand || 'Solely'}</small>
                  </span>
                </Link>
              )) : null}
            </div>
          ) : null}
          <input
            ref={headerFileInputRef}
            className="header-search__file-input"
            type="file"
            hidden
            tabIndex={-1}
            accept="image/jpeg,image/png"
            capture="environment"
            aria-label="Chọn ảnh để tìm từ thanh đầu trang"
            onChange={selectHeaderImage}
          />
          {searchError ? (
            <p id="header-search-error" className="header-search__error" role="alert">
              {searchError}
            </p>
          ) : null}
        </form>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button theme-toggle"
            aria-label={isDarkTheme ? 'Chuyển sang light mode' : 'Chuyển sang dark mode'}
            aria-pressed={isDarkTheme}
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          >
            {isDarkTheme ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
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
