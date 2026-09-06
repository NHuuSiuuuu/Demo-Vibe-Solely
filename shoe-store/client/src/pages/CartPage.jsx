import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import { colorLabel } from '../utils/formatters.js';

export default function CartPage() {
  const { token } = useAuth();
  const { cart, updateItem, removeItem } = useCart();
  const items = cart.items || [];

  async function updateQuantity(item, value) {
    await updateItem(item.id, Number(value));
  }

  if (!token) {
    return <AuthPrompt message="Đăng nhập hoặc đăng ký để xem túi hàng và thanh toán." />;
  }

  return (
    <section className="shop-page" aria-labelledby="cart-title">
      <div className="section-heading">
        <h1 id="cart-title">Túi hàng</h1>
        <Link className="button-link" to="/checkout">
          Thanh toán
        </Link>
      </div>
      {items.length === 0 ? <p className="muted">Túi hàng của bạn đang trống.</p> : null}
      <div className="line-items">
        {items.map((item) => (
          <article className="line-item" key={item.id}>
            <div>
              <h2>{item.productName}</h2>
              <p>
                Size {item.size} / {colorLabel(item.color)} / {item.sku}
              </p>
            </div>
            <p>{formatMoney(item.unitPrice)}</p>
            <label>
              Số lượng
              <input
                type="number"
                min="1"
                max={item.stockQuantity}
                value={item.quantity}
                onChange={(event) => updateQuantity(item, event.target.value)}
              />
            </label>
            <p>{formatMoney(item.lineTotal)}</p>
            <button type="button" className="button-secondary" onClick={() => removeItem(item.id)}>
              Xóa
            </button>
          </article>
        ))}
      </div>
      <div className="summary-row">
        <span>Tạm tính</span>
        <strong>{formatMoney(cart.subtotal)}</strong>
      </div>
    </section>
  );
}
